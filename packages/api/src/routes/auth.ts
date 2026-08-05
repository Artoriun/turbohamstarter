import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../asyncHandler';
import { clearAttempts, currentEpoch, recordAttempt, revokeAllTokens } from '../authState';
import { requireAuth } from '../middleware/requireAuth';
import { adminPasswordConfigured, verifyAdminPassword } from '../password';
import { createRateLimiter } from '../rateLimit';

export const authRouter = Router();

// Two layers. The Firestore record survives restarts, which the free tier does often; this
// one catches a burst inside a single process without a round trip per attempt, and is the
// only limit left if Firestore is unreachable.
const burstLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

/**
 * Wait a little longer after each failure — 0s, 0.5s, 1s, 2s… capped at 4s. Cheap for a
 * person who has mistyped once and expensive for a script, without ever locking the owner
 * out the way a hard lockout would.
 */
const backoffMs = (failures: number) =>
  Math.min(4000, failures < 1 ? 0 : 2 ** (failures - 1) * 500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    if (burstLimited(ip)) {
      console.warn(`[auth] burst limit hit from ${ip}`);
      res.status(429).json({ error: 'Too many attempts. Try again later.' });
      return;
    }

    const { blocked, recentFailures } = await recordAttempt(ip);
    if (blocked) {
      console.warn(`[auth] rate limit hit from ${ip}`);
      res.status(429).json({ error: 'Too many attempts. Try again later.' });
      return;
    }

    const { password } = req.body as { password?: string };
    if (!password || !verifyAdminPassword(password)) {
      await sleep(backoffMs(recentFailures));
      console.warn(`[auth] failed login from ${ip} (${recentFailures + 1} in window)`);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

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
