import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { resetEpochCache, revokeAllTokens, setAuthStore } from '../authState';
import { requireAuth } from '../middleware/requireAuth';
import { hashPassword } from '../password';
import { createFakeStore } from '../testing/fakeStore';
import { authRouter } from './auth';

/**
 * The login flow end to end, over real HTTP, against an in-memory stand-in for Firestore.
 *
 * `trust proxy` is on so each test can present its own X-Forwarded-For. Without that every
 * request would share one address and the burst limiter — module-level state, ten per
 * quarter hour — would exhaust itself part-way through the file and fail later tests for
 * the wrong reason.
 */

const SECRET = 'test-jwt-secret';
const PASSWORD = 'the-current-password';

let server: Server;
let base = '';
let fake: ReturnType<typeof createFakeStore>;
let ipCounter = 0;
const nextIp = () => `203.0.113.${++ipCounter % 250}`;

before(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
      resolve();
    });
  });
});
after(() => server?.close());

beforeEach(() => {
  fake = createFakeStore();
  setAuthStore(fake);
  resetEpochCache();
  process.env.JWT_SECRET = SECRET;
  process.env.ADMIN_PASSWORD = PASSWORD;
  delete process.env.ADMIN_PASSWORD_HASH;
});
afterEach(() => {
  setAuthStore(null);
  resetEpochCache();
});

const login = (password: string, ip = nextIp()) =>
  fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ password }),
  });

const getProtected = (token?: string) =>
  fetch(`${base}/protected`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

describe('POST /api/auth/login', () => {
  test('the current password logs in and returns a token', async () => {
    const res = await login(PASSWORD);
    assert.equal(res.status, 200);
    const { token } = (await res.json()) as { token: string };
    const payload = jwt.verify(token, SECRET) as Record<string, unknown>;
    assert.equal(payload.admin, true);
    assert.equal(typeof payload.epoch, 'number');
  });

  test('a hashed password works the same way', async () => {
    delete process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD_HASH = hashPassword(PASSWORD);
    assert.equal((await login(PASSWORD)).status, 200);
    assert.equal((await login('wrong')).status, 401);
  });

  test('a wrong password is refused', async () => {
    assert.equal((await login('wrong')).status, 401);
  });

  test('missing configuration returns 503 rather than signing with undefined', async () => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_HASH;
    assert.equal((await login(PASSWORD)).status, 503);
  });

  test('repeated failures from one address are eventually rate-limited', async () => {
    const ip = nextIp();
    let sawLimit = false;
    for (let i = 0; i < 14; i++) {
      const res = await login('wrong', ip);
      if (res.status === 429) {
        sawLimit = true;
        break;
      }
    }
    assert.ok(sawLimit, 'a stream of wrong passwords should hit 429');
  });

  test('a correct password clears the record, so one mistype costs nothing later', async () => {
    const ip = nextIp();
    for (let i = 0; i < 3; i++) await login('wrong', ip);
    assert.equal((await login(PASSWORD, ip)).status, 200);
    // Cleared: the next wrong attempt starts from zero rather than near the cap.
    assert.equal((await login('wrong', ip)).status, 401);
  });

  test('failures get slower, which costs a script and not a person', async () => {
    const ip = nextIp();
    const started = Date.now();
    for (let i = 0; i < 4; i++) await login('wrong', ip);
    // 0 + 0.5 + 1 + 2 = 3.5s of deliberate delay.
    assert.ok(Date.now() - started > 3000, `expected backoff, took ${Date.now() - started}ms`);
  });
});

describe('requireAuth', () => {
  const tokenFor = (payload: object, secret = SECRET, options: jwt.SignOptions = {}) =>
    jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '7d', ...options });

  test('accepts a token this API issued', async () => {
    assert.equal((await getProtected(tokenFor({ admin: true, epoch: 0 }))).status, 200);
  });

  test('rejects a missing or malformed header', async () => {
    assert.equal((await getProtected()).status, 401);
    const res = await fetch(`${base}/protected`, { headers: { Authorization: 'Token abc' } });
    assert.equal(res.status, 401);
  });

  test('rejects a token signed with a different secret', async () => {
    assert.equal((await getProtected(tokenFor({ admin: true }, 'other-secret'))).status, 401);
  });

  test('rejects a valid signature without the admin claim', async () => {
    // A signature only proves the token was minted with this secret, not that it was minted
    // for the portal.
    assert.equal((await getProtected(tokenFor({ user: 'someone' }))).status, 401);
  });

  test('rejects an expired token', async () => {
    assert.equal(
      (await getProtected(tokenFor({ admin: true }, SECRET, { expiresIn: -10 }))).status,
      401,
    );
  });

  test('rejects an unsigned alg:none forgery', async () => {
    const forged = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ admin: true })).toString('base64url')}.`;
    assert.equal((await getProtected(forged)).status, 401);
  });

  test('does not leak why a token failed', async () => {
    // Expired versus wrong-key versus malformed is a free hint to anyone probing; the
    // reason belongs in the server log.
    const res = await getProtected(tokenFor({ admin: true }, 'other-secret'));
    const body = (await res.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body), ['error']);
    assert.equal(body.error, 'jwt-invalid');
  });

  test('rejects a token issued before the last revoke-all', async () => {
    const stale = tokenFor({ admin: true, epoch: 0 });
    assert.equal((await getProtected(stale)).status, 200, 'valid before revoking');
    await revokeAllTokens();
    assert.equal((await getProtected(stale)).status, 401, 'refused after revoking');
  });

  test('a token issued after revoking still works', async () => {
    await revokeAllTokens();
    const { token } = (await (await login(PASSWORD)).json()) as { token: string };
    assert.equal((await getProtected(token)).status, 200);
  });
});

describe('POST /api/auth/refresh', () => {
  const refresh = (token?: string) =>
    fetch(`${base}/api/auth/refresh`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  test('requires a valid token of its own', async () => {
    assert.equal((await refresh()).status, 401);
    assert.equal((await refresh('not-a-jwt')).status, 401);
    assert.equal(
      (await refresh(jwt.sign({ admin: true }, 'other-secret'))).status,
      401,
      'refreshing must not be a way around the signature check',
    );
  });

  test('extends a live session', async () => {
    const { token } = (await (await login(PASSWORD)).json()) as { token: string };
    const before = (jwt.decode(token) as { exp: number }).exp;
    // The expiry is whole seconds, so a same-second refresh returns a byte-identical token
    // and proves nothing. Waiting a beat is what makes the comparison meaningful.
    await new Promise((r) => setTimeout(r, 1100));

    const res = await refresh(token);
    assert.equal(res.status, 200);
    const { token: fresh } = (await res.json()) as { token: string };
    const payload = jwt.verify(fresh, SECRET) as { admin: boolean; exp: number };
    assert.equal(payload.admin, true);
    assert.ok(payload.exp > before, 'the new token should outlive the old one');
    assert.equal((await getProtected(fresh)).status, 200);
  });

  test('an expired token cannot be refreshed back to life', async () => {
    const dead = jwt.sign({ admin: true, epoch: 0 }, SECRET, {
      algorithm: 'HS256',
      expiresIn: -10,
    });
    assert.equal((await refresh(dead)).status, 401);
  });

  test('a revoked session cannot refresh its way back in', async () => {
    // The point of revoke-all is that it is final. Carrying the old token's epoch across a
    // refresh would quietly undo it for whoever holds the token.
    const { token } = (await (await login(PASSWORD)).json()) as { token: string };
    await revokeAllTokens();
    assert.equal((await refresh(token)).status, 401);
  });
});

describe('POST /api/auth/revoke-all', () => {
  test('requires a valid token of its own', async () => {
    const res = await fetch(`${base}/api/auth/revoke-all`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  test('signs out every session, including the caller', async () => {
    const { token } = (await (await login(PASSWORD)).json()) as { token: string };
    assert.equal((await getProtected(token)).status, 200);
    const res = await fetch(`${base}/api/auth/revoke-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    assert.equal((await getProtected(token)).status, 401, 'the caller is signed out too');
  });
});
