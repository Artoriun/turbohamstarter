import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import {
  clearToken,
  readToken,
  SESSION_EXPIRED_EVENT,
  secondsLeft,
  signalSessionExpired,
  storeToken,
} from './token';

/**
 * The client's view of the session.
 *
 * Written after a client reported being "logged out immediately" on navigating away from the
 * admin portal and back. The portal was fine; the token had run out days earlier, and the
 * expiry was only ever checked when the page mounted — so the dashboard went on looking
 * signed in until a navigation happened to re-check.
 *
 * Node's test runner has no DOM, so the two globals this module touches are stubbed below.
 */

const store = new Map<string, string>();
const dispatched: string[] = [];

// biome-ignore lint/suspicious/noExplicitAny: assigning DOM stand-ins onto the Node global
const g = globalThis as any;
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
g.window = { dispatchEvent: (e: { type: string }) => void dispatched.push(e.type) };
g.Event = class {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
};

/** A token shaped like the real thing, since only the payload's `exp` is ever read. */
const tokenExpiringIn = (seconds: number) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(
    JSON.stringify({ admin: true, exp: Math.floor(Date.now() / 1000) + seconds }),
  ).toString('base64url')}.signature`;

beforeEach(() => {
  store.clear();
  dispatched.length = 0;
});

describe('secondsLeft', () => {
  test('reports the life left in a live token', () => {
    const left = secondsLeft(tokenExpiringIn(3600));
    assert.ok(left > 3500 && left <= 3600, `expected about an hour, got ${left}`);
  });

  test('an expired token has none left', () => {
    assert.equal(secondsLeft(tokenExpiringIn(-60)), 0);
  });

  test('anything unreadable counts as expired rather than throwing', () => {
    // A truncated value in localStorage must not take the portal down on load.
    for (const junk of ['', 'not-a-jwt', 'a.b', 'a.!!!not-base64!!!.c', 'a.e30=.c']) {
      assert.equal(secondsLeft(junk), 0, `expected 0 for ${JSON.stringify(junk)}`);
    }
  });
});

describe('readToken', () => {
  test('returns a live token', () => {
    const token = tokenExpiringIn(3600);
    storeToken(token);
    assert.equal(readToken(), token);
  });

  test('returns null when nothing is stored', () => {
    assert.equal(readToken(), null);
  });

  test('refuses an expired token and clears it out', () => {
    // The bug: this used to be checked only at mount, so a stale token stayed in place and
    // was sent on every request until one of them failed.
    storeToken(tokenExpiringIn(-60));
    assert.equal(readToken(), null);
    assert.equal(store.get('admin_token'), undefined, 'the dead token should not linger');
  });
});

describe('signalSessionExpired', () => {
  test('clears the token and announces it, so the portal can explain itself', () => {
    storeToken(tokenExpiringIn(3600));
    signalSessionExpired();
    assert.equal(readToken(), null);
    assert.deepEqual(dispatched, [SESSION_EXPIRED_EVENT]);
  });
});

describe('clearToken', () => {
  test('signing out leaves nothing behind', () => {
    storeToken(tokenExpiringIn(3600));
    clearToken();
    assert.equal(readToken(), null);
  });
});
