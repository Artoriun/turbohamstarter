import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { currentEpoch } from '../authState';

/**
 * A request that has been through `requireAuth`, carrying the epoch of the token it presented.
 *
 * Exposed so `/auth/refresh` can stamp the replacement with the *presented* epoch rather than
 * re-reading the current one. Re-reading loses a race: if a revoke-all lands between the check
 * below and the handler signing, the fresh token would be stamped with the new epoch and
 * outlive the revoke it should have died to.
 */
export interface AuthedRequest extends Request {
  adminEpoch?: number;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.status(401).json({ error: 'no-auth-header' });
    return;
  }
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'bad-auth-format' });
    return;
  }
  if (!process.env.JWT_SECRET) {
    res.status(500).json({ error: 'server-misconfigured' });
    return;
  }
  try {
    // Pinning the algorithm closes off algorithm-confusion attacks. jsonwebtoken 9 already
    // rejects `alg: none`, so this is defence in depth rather than a live hole — but it
    // costs nothing and does not rely on the library keeping that default.
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    // A valid signature only proves the token was minted with this secret, not that it was
    // minted for the admin portal. Checking the claim means a token issued for anything
    // else with the same secret cannot be replayed here.
    if (typeof payload !== 'object' || payload === null || payload.admin !== true) {
      res.status(401).json({ error: 'jwt-invalid' });
      return;
    }
    // Tokens minted before the last "revoke all" are refused even though their signature
    // and expiry are still good. This is what makes a leaked token recoverable without
    // rotating JWT_SECRET and restarting the API.
    if ((payload.epoch ?? 0) < (await currentEpoch())) {
      console.warn('[auth] token predates the current epoch; treating as revoked');
      res.status(401).json({ error: 'jwt-revoked' });
      return;
    }
    (req as AuthedRequest).adminEpoch = payload.epoch ?? 0;
    next();
  } catch (err) {
    // The reason stays in the server log rather than the response. Returning it told the
    // caller whether a token was expired, malformed or signed with the wrong key — a free
    // hint to anyone probing, and the log is where it is actually useful.
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[auth] token rejected: ${reason}`);
    res.status(401).json({ error: 'jwt-invalid' });
  }
}
