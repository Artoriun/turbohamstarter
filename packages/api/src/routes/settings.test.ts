import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { setStore } from '../firebaseAdmin';
import { createFakeStore } from '../testing/fakeStore';
import { contentRouter } from './content';
import { settingsRouter } from './settings';

/**
 * The point of these is that the filter is enforced on the *write*, not in the browser.
 * The portal's live warning is a convenience; anything holding a token can skip the UI
 * entirely, so if the API does not refuse the write then the feature does not exist.
 */

let server: Server;
let base = '';
let fake: ReturnType<typeof createFakeStore>;
let token = '';

const SECRET = 'test-secret-for-settings';

before(async () => {
  process.env.JWT_SECRET = SECRET;
  token = jwt.sign({ admin: true, epoch: 0 }, SECRET, { algorithm: 'HS256' });

  const app = express();
  app.use(express.json());
  app.use('/api/settings', settingsRouter);
  app.use('/api/content', contentRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
      resolve();
    });
  });
});

after(() => server.close());

beforeEach(() => {
  fake = createFakeStore();
  setStore(fake);
});
afterEach(() => setStore(null));

const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

const setFilter = (on: boolean, blocklist?: string[]) =>
  fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ profanityFilter: on, blocklist }),
  });

const write = (heading: string) =>
  fetch(`${base}/api/content/hero`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ heading }),
  });

describe('settings endpoint', () => {
  test('requires a token in both directions', async () => {
    assert.equal((await fetch(`${base}/api/settings`)).status, 401);
    assert.equal((await fetch(`${base}/api/settings`, { method: 'PUT', body: '{}' })).status, 401);
  });

  test('defaults to the filter being on', async () => {
    const res = await fetch(`${base}/api/settings`, { headers: auth });
    assert.deepEqual(await res.json(), { profanityFilter: true });
  });

  test('normalises the blocklist, so it cannot fill with blanks or duplicates', async () => {
    await setFilter(true, ['  Damn ', 'damn', 'CRAP', '', '   ']);
    const res = await fetch(`${base}/api/settings`, { headers: auth });
    const { blocklist } = (await res.json()) as { blocklist: string[] };
    assert.deepEqual(blocklist, ['damn', 'crap']);
  });
});

describe('the filter is enforced on the write', () => {
  test('blocks by default, with no configuration at all', async () => {
    // The portal hides the control, so this default is what most sites will run.
    const res = await write('what a load of bollocks');
    assert.equal(res.status, 422);
  });

  test('lets profanity through once switched off', async () => {
    await setFilter(false);
    const res = await write('what a load of bollocks');
    assert.equal(res.status, 200, 'the filter is off, so this must be allowed');
  });

  test('names the words it refused', async () => {
    await setFilter(true);
    const res = await write('what a load of bollocks');
    assert.equal(res.status, 422);
    const body = (await res.json()) as { words: string[] };
    assert.deepEqual(body.words, ['bollocks']);
  });

  test('still allows clean text while it is on', async () => {
    await setFilter(true);
    assert.equal((await write('a perfectly ordinary heading')).status, 200);
  });

  test('does not refuse a legitimate word that merely contains one', async () => {
    await setFilter(true);
    // The regression that makes people switch the feature off entirely.
    assert.equal((await write('Scunthorpe in classic assessment')).status, 200);
  });

  test('honours a custom blocklist instead of the built-in one', async () => {
    await setFilter(true, ['bananas']);
    assert.equal((await write('what a load of bollocks')).status, 200);
    const res = await write('bananas');
    assert.equal(res.status, 422);
    assert.deepEqual(((await res.json()) as { words: string[] }).words, ['bananas']);
  });

  test('an unreadable settings document is not reported as a filter block', async () => {
    await setFilter(true);
    fake.breakWith('firestore unreachable');
    // The write itself still fails (its own store is broken), but the filter must not be
    // what refuses it — a settings outage should not start rejecting content.
    const res = await write('what a load of bollocks');
    assert.notEqual(res.status, 422, 'a settings read failure must not present as a filter block');
  });
});
