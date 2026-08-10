import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import { clientErrorsRouter } from './clientErrors';

/**
 * The endpoint is anonymous and public, so the caps matter more than the happy path: it
 * must not become a way to fill the log.
 */

let server: Server;
let url = '';
const logged: string[] = [];
const realError = console.error;

before(async () => {
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  };
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/client-errors', clientErrorsRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/api/client-errors`;
      resolve();
    });
  });
});
after(() => {
  console.error = realError;
  server?.close();
});

let ip = 0;
const post = (body: unknown, from = `198.51.100.${++ip % 250}`) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': from },
    body: JSON.stringify(body),
  });

describe('POST /api/client-errors', () => {
  test('records a report and answers 204', async () => {
    const res = await post({ message: 'Cannot read properties of undefined', url: '/poems' });
    assert.equal(res.status, 204);
    assert.ok(logged.some((l) => l.includes('Cannot read properties of undefined')));
  });

  test('requires a message', async () => {
    assert.equal((await post({ url: '/poems' })).status, 400);
    assert.equal((await post({ message: '   ' })).status, 400);
  });

  test('truncates so one report cannot flood the log', async () => {
    logged.length = 0;
    await post({ message: 'x'.repeat(5000), stack: 'y'.repeat(50_000) });
    const entry = logged.join('');
    assert.ok(entry.length < 4000, `entry should be capped, was ${entry.length}`);
  });

  test('collapses newlines, so a report cannot forge extra log lines', async () => {
    logged.length = 0;
    await post({ message: 'real\n[client] fake entry injected by the payload' });
    const entry = logged.join('');
    assert.ok(!entry.includes('\n[client] fake'), 'newlines in the message must not survive');
  });

  test('ignores non-string fields rather than throwing', async () => {
    const res = await post({ message: 'ok', stack: { nested: true }, url: 42 });
    assert.equal(res.status, 204);
  });

  test('rate-limits one address, and answers 204 rather than 429', async () => {
    const from = '203.0.113.99';
    let sawCap = false;
    for (let i = 0; i < 30; i++) {
      const res = await post({ message: `flood ${i}` }, from);
      assert.equal(res.status, 204, 'a broken page should never be told its report failed');
      logged.length = 0;
      const next = await post({ message: `probe ${i}` }, from);
      if (next.status === 204 && logged.length === 0) {
        sawCap = true;
        break;
      }
    }
    assert.ok(sawCap, 'reports from one address should stop being recorded');
  });
});
