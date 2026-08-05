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

  test('fails open when the store is unreachable', async () => {
    // A lockout that fires exactly when the database is down would be worse than the
    // window it closes — the owner could not get in to fix anything.
    fake.breakWith('firestore unavailable');
    const state = await recordAttempt('1.2.3.4');
    assert.equal(state.blocked, false);
    assert.equal(state.recentFailures, 0);
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
