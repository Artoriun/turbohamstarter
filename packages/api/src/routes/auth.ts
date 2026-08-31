import { type Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../asyncHandler';
import { clearAttempts, currentEpoch, recordAttempt, revokeAllTokens } from '../authState';
import { type AuthedRequest, requireAuth } from '../middleware/requireAuth';
import { adminPasswordConfigured, verifyAdminPassword } from '../password';
import { createLockout, createRateLimiter } from '../rateLimit';

export const authRouter = Router();

// Two layers. The Firestore record survives restarts, which the free tier does often; this
// one catches a burst inside a single process without a round trip per attempt, and is the
// only limit left if Firestore is unreachable.
const burstLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

/**
 * Three wrong passwords in a row, then thirty seconds. Sits on top of the two limits above
 * rather than replacing them: on its own it would allow 360 guesses an hour against their 40.
 * What it adds is something a person can see happening.
 */
const lockout = createLockout({ maxFailures: 3, lockMs: 30 * 1000 });

/**
 * Wait a little longer after each failure — 0s, 0.5s, 1s, 2s… capped at 4s. Cheap for a
 * person who has mistyped once and expensive for a script. The count comes from the
 * fifteen-minute window rather than the lockout, so it keeps climbing across lockouts
 * instead of restarting at zero with each one.
 */
const backoffMs = (failures: number) =>
  Math.min(4000, failures < 1 ? 0 : 2 ** (failures - 1) * 500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `retryAfter` is what the sign-in screen counts down. All three limits can say how long they
 * need, but the parameter stays optional: a 429 with no wait attached is still a valid answer,
 * and the screen falls back to a plain "try again later" for it.
 */
function tooManyAttempts(res: Response, seconds?: number) {
  if (seconds) res.set('Retry-After', String(seconds));
  res.status(429).json({ error: 'Too many attempts. Try again later.', retryAfter: seconds });
}

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const secret = process.env.JWT_SECRET;
    if (!adminPasswordConfigured() || !secret) {
      console.error('[auth] ADMIN_PASSWORD/ADMIN_PASSWORD_HASH or JWT_SECRET is not set');
      res.status(503).json({ error: 'Authentication is not configured' });
      return;
    }

    const ip = req.ip ?? 'unknown';
    const locked = lockout.lockedFor(ip);
    if (locked) {
      tooManyAttempts(res, locked);
      return;
    }

    const burstWait = burstLimited(ip);
    if (burstWait) {
      console.warn(`[auth] burst limit hit from ${ip}`);
      tooManyAttempts(res, burstWait);
      return;
    }

    const { blocked, recentFailures, retryAfter } = await recordAttempt(ip);
    if (blocked) {
      console.warn(`[auth] rate limit hit from ${ip}`);
      tooManyAttempts(res, retryAfter);
      return;
    }

    const { password } = req.body as { password?: string };
    if (!password || !verifyAdminPassword(password)) {
      console.warn(`[auth] failed login from ${ip} (${recentFailures + 1} in window)`);
      const nowLocked = lockout.fail(ip);
      if (nowLocked) {
        // No backoff on top: the wait is the lockout, and the screen is already counting it down.
        tooManyAttempts(res, nowLocked);
        return;
      }
      await sleep(backoffMs(recentFailures));
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    lockout.clear(ip);
    await clearAttempts(ip);
    // The epoch is carried in the token and compared on every request, so bumping it via
    // /revoke-all invalidates everything issued before that moment.
    const epoch = await currentEpoch();
    const token = jwt.sign({ admin: true, epoch }, secret, {
      algorithm: 'HS256',
      expiresIn: '7d',
    });
    res.json({ token });
  }),
);

/**
 * Trades a still-valid token for a fresh one, so an admin who keeps using the portal is never
 * cut off at the 7-day wall mid-edit. `requireAuth` has already checked the signature, the
 * expiry and the epoch, so reaching here is proof enough to mint a replacement.
 */
authRouter.post(
  '/refresh',
  requireAuth,
  asyncHandler(async (req, res) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(503).json({ error: 'Authentication is not configured' });
      return;
    }
    // The presented token's epoch, not the current one. A revoke-all landing between
    // requireAuth's check and this line would otherwise be undone: re-reading would stamp the
    // replacement with the new epoch, and the session that should have died to the revoke
    // would carry on. Inheriting means the replacement is exactly as revocable as the token
    // it replaces.
    const epoch = (req as AuthedRequest).adminEpoch ?? 0;
    const token = jwt.sign({ admin: true, epoch }, secret, { algorithm: 'HS256', expiresIn: '7d' });
    res.json({ token });
  }),
);

/** Signs out every session, including any token that has been copied elsewhere. */
authRouter.post(
  '/revoke-all',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const epoch = await revokeAllTokens();
    console.warn(`[auth] all tokens revoked; epoch is now ${epoch}`);
    res.json({ ok: true });
  }),
);
