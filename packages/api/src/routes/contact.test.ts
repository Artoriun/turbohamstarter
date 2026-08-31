import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import { contactRouter } from './contact';

/**
 * Exercises the contact endpoint over real HTTP. This is the most exposed surface in the
 * API — it takes anonymous input and turns it into an email — and every guard on it was
 * previously verified only by hand.
 *
 * No mail transport is configured here, so an otherwise valid request ends at 503. That is
 * deliberate: every check under test happens before the send, and it keeps the suite from
 * needing credentials or a network.
 */

let server: Server;
let url = '';

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/contact', contactRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/api/contact`;
      resolve();
    });
  });
});
after(() => server?.close());

const valid = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Hello',
  message: 'A message.',
};
const post = (body: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/contact', () => {
  // These all fail validation, which happens before the rate limiter, so they cost no
  // budget. The limiter is module-level state shared by every test in this file — hence
  // the ordering, with the one test that spends it deliberately placed last.

  test('rejects a missing field', async () => {
    for (const key of ['name', 'email', 'subject', 'message'] as const) {
      const res = await post({ ...valid, [key]: '' });
      assert.equal(res.status, 400, `missing ${key} should be rejected`);
    }
  });

  test('rejects whitespace-only input, which would otherwise pass a truthiness check', async () => {
    const res = await post({ ...valid, message: '   \n  ' });
    assert.equal(res.status, 400);
  });

  test('rejects a malformed address', async () => {
    for (const email of ['not-an-email', 'no@tld', 'two@@at.com', 'spaces in@example.com']) {
      const res = await post({ ...valid, email });
      assert.equal(res.status, 400, `should reject: ${email}`);
    }
  });

  test('rejects newlines in fields that reach mail headers', async () => {
    // The injection this guards against: a newline lets the sender append their own
    // headers, turning the contact form into an open relay.
    const injection = 'x\r\nBcc: victim@example.com';
    for (const key of ['name', 'email', 'subject'] as const) {
      const res = await post({ ...valid, [key]: injection });
      assert.equal(res.status, 400, `${key} must not accept a newline`);
    }
  });

  test('rejects over-long fields', async () => {
    const cases: Array<[keyof typeof valid, number]> = [
      ['name', 101],
      ['email', 201],
      ['subject', 151],
      ['message', 5001],
    ];
    for (const [key, len] of cases) {
      const filler = key === 'email' ? `${'a'.repeat(len - 12)}@example.com` : 'a'.repeat(len);
      const res = await post({ ...valid, [key]: filler });
      assert.equal(res.status, 400, `${key} over its cap should be rejected`);
    }
  });

  test('silently accepts a honeypot submission without sending', async () => {
    // Answering 200 matters: a bot that can tell it was filtered will adapt. This also
    // returns before the rate limiter, so bots cannot exhaust a real visitor's budget.
    const res = await post({ ...valid, website: 'http://spam.example' });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  test('a valid message reaches the send step and reports the missing transport', async () => {
    // 503 rather than a cheerful 200: the message is not quietly discarded.
    const res = await post(valid);
    assert.equal(res.status, 503);
  });

  // Must run last: it spends the remaining per-IP budget for the whole file.
  test('rate-limits repeated valid submissions', async () => {
    let sawLimit = false;
    for (let i = 0; i < 8; i++) {
      const res = await post(valid);
      if (res.status === 429) {
        sawLimit = true;
        break;
      }
      assert.equal(res.status, 503, 'until the cap, requests reach the send step');
    }
    assert.ok(sawLimit, 'repeated submissions from one address should hit 429');
  });
});
