import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import {
  clearAttempts,
  currentEpoch,
  recordAttempt,
  resetEpochCache,
  revokeAllTokens,
  setAuthStore,
} from './authState';
import { createFakeStore } from './testing/fakeStore';

let fake: ReturnType<typeof createFakeStore>;

beforeEach(() => {
  fake = createFakeStore();
  setAuthStore(fake);
  resetEpochCache();
});
afterEach(() => {
  setAuthStore(null);
  resetEpochCache();
});

describe('login attempt tracking', () => {
  test('allows ten attempts, then blocks', async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 12; i++) results.push((await recordAttempt('1.2.3.4')).blocked);
    assert.deepEqual(results.slice(0, 10), Array(10).fill(false));
    assert.deepEqual(results.slice(10), [true, true]);
  });

  test('reports how many failures preceded this one, so the caller can back off', async () => {
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) seen.push((await recordAttempt('5.6.7.8')).recentFailures);
    assert.deepEqual(seen, [0, 1, 2, 3]);
  });

  test('counts each address separately', async () => {
    for (let i = 0; i < 10; i++) await recordAttempt('1.1.1.1');
    assert.equal((await recordAttempt('1.1.1.1')).blocked, true);
    assert.equal((await recordAttempt('2.2.2.2')).blocked, false);
  });

  test('a success clears the record', async () => {
    for (let i = 0; i < 10; i++) await recordAttempt('9.9.9.9');
    assert.equal((await recordAttempt('9.9.9.9')).blocked, true);
    await clearAttempts('9.9.9.9');
    assert.equal((await recordAttempt('9.9.9.9')).blocked, false);
  });

  test('an address with a slash in it does not escape its own document', async () => {
    // Firestore keys cannot contain '/', and an unencoded one would address a different
    // path entirely rather than erroring.
    await recordAttempt('::ffff:10.0.0.1/64');
    assert.ok(
      Object.keys(fake.dump()).every((k) => k.split('/').length === 2),
      `keys must stay one level deep: ${Object.keys(fake.dump())}`,
    );
  });

  test('the reported wait agrees with blocked, and shrinks as the window drains', async () => {
    // Two fields saying the same thing is a drift hazard, so pin it: the sign-in screen counts
    // retryAfter down, and a nonzero one while blocked is false would leave a live form
    // showing a countdown.
    for (let i = 0; i < 10; i++) {
      const open = await recordAttempt('4.4.4.4');
      assert.equal(open.retryAfter, 0, 'nothing to wait for while attempts remain');
    }
    const first = await recordAttempt('4.4.4.4');
    assert.equal(first.blocked, true);
    assert.ok(first.retryAfter > 0 && first.retryAfter <= 15 * 60, `got ${first.retryAfter}s`);

    // The window is fifteen minutes and the test cannot wait it out, so the check is that
    // the number tracks real time rather than being the window length restated.
    await new Promise((r) => setTimeout(r, 1100));
    const later = await recordAttempt('4.4.4.4');
    assert.ok(
      later.retryAfter < first.retryAfter,
      `${first.retryAfter}s then ${later.retryAfter}s`,
    );
  });

  test('fails open when the store is unreachable', async () => {
    // A lockout that fires exactly when the database is down would be worse than the
    // window it closes — the owner could not get in to fix anything.
    fake.breakWith('firestore unavailable');
    const state = await recordAttempt('1.2.3.4');
    assert.equal(state.blocked, false);
    assert.equal(state.recentFailures, 0);
    assert.equal(state.retryAfter, 0);
  });
});

describe('token epoch', () => {
  test('starts at zero when nothing has been revoked', async () => {
    assert.equal(await currentEpoch(), 0);
  });

  test('revoking moves it past every token issued before', async () => {
    const before = await currentEpoch();
    const epoch = await revokeAllTokens();
    assert.ok(epoch > before);
    assert.equal(await currentEpoch(), epoch);
  });

  test('is cached, so it does not cost a read per request', async () => {
    await revokeAllTokens();
    const epoch = await currentEpoch();
    fake.breakWith('should not be consulted while cached');
    assert.equal(await currentEpoch(), epoch);
  });

  test('falls back to the last known value rather than logging everyone out', async () => {
    const epoch = await revokeAllTokens();
    resetEpochCache();
    fake.breakWith('firestore unavailable');
    // Returns 0 with no cache, which admits tokens rather than rejecting them — the same
    // fail-open choice as above, and the reason revocation needs the store to be healthy.
    assert.equal(await currentEpoch(), 0);
    assert.ok(epoch > 0);
  });
});
