import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import { asyncHandler } from './asyncHandler';
import { errorHandler } from './errorHandler';

/**
 * What the API says when something goes wrong.
 *
 * The distinction being pinned is who is at fault. A body Express could not parse is the
 * caller's problem and has to say 400 — answering 500 sends whoever is debugging it to the
 * server logs for a fault that is in their request. Firestore being absent is neither: the
 * request was fine and the deployment is incomplete, which is 503.
 *
 * The 400 case is not hypothetical. It was found in kov-cs-poetry by sending a malformed body
 * by accident while checking the API booted; this repo and qalor-website had the identical
 * handler and so the identical answer of 500. Express 5 forwards rejections on its own, but a
 * custom handler still has to read the status the parser attached.
 */

let server: Server;
let base = '';

before(async () => {
  const app = express();
  app.use(express.json());
  app.post('/echo', (_req, res) => res.json({ ok: true }));
  app.get(
    '/boom',
    asyncHandler(async () => {
      throw new Error('firestore unavailable');
    }),
  );
  app.get(
    '/unconfigured',
    asyncHandler(async () => {
      throw new Error('Firestore is not configured');
    }),
  );
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
      resolve();
    });
  });
});
after(() => server?.close());

describe('errorHandler', () => {
  test('a body Express cannot parse is the caller’s fault: 400', async () => {
    const res = await fetch(`${base}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"password":',
      signal: AbortSignal.timeout(2000),
    });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: string }).error, 'Malformed request');
  });

  test('a failure inside a handler is the server’s: 500, with nothing leaked', async () => {
    const res = await fetch(`${base}/boom`, { signal: AbortSignal.timeout(2000) });
    assert.equal(res.status, 500);
    // The message names an internal dependency; it belongs in the log, not the response.
    assert.equal(((await res.json()) as { error: string }).error, 'Internal error');
  });

  test('missing configuration is 503, and does say so', async () => {
    const res = await fetch(`${base}/unconfigured`, { signal: AbortSignal.timeout(2000) });
    assert.equal(res.status, 503);
    assert.match(((await res.json()) as { error: string }).error, /not configured/);
  });
});
