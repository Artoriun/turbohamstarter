import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createLockout, createRateLimiter } from './rateLimit';

describe('rate limiter', () => {
  test('allows up to max, then reports the wait', () => {
    const limited = createRateLimiter({ windowMs: 60_000, max: 3 });
    assert.deepEqual(
      [1, 2, 3, 4, 5].map(() => limited('1.2.3.4')),
      [0, 0, 0, 60, 60],
      'zero while there is room, then the seconds until the oldest hit ages out',
    );
  });

  test('the reported wait shrinks as the window drains', async () => {
    // The login screen counts this down, so it has to be the real remaining time rather
    // than the window length restated on every rejection.
    const limited = createRateLimiter({ windowMs: 3_000, max: 1 });
    limited('1.2.3.9');
    const first = limited('1.2.3.9');
    await new Promise((r) => setTimeout(r, 1100));
    const later = limited('1.2.3.9');
    assert.ok(later < first, `expected the wait to shrink: ${first}s then ${later}s`);
    assert.ok(later > 0, 'and never to read zero while still blocked');
  });

  test('counts each address separately', () => {
    const limited = createRateLimiter({ windowMs: 60_000, max: 2 });
    limited('1.1.1.1');
    limited('1.1.1.1');
    assert.ok(limited('1.1.1.1') > 0, 'first address is spent');
    assert.equal(limited('2.2.2.2'), 0, 'a different address is unaffected');
  });

  test('the window expires', async () => {
    const limited = createRateLimiter({ windowMs: 40, max: 1 });
    assert.equal(limited('3.3.3.3'), 0);
    assert.ok(limited('3.3.3.3') > 0);
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(limited('3.3.3.3'), 0, 'allowed again once the window has passed');
  });

  test('a blocked caller does not extend its own block by retrying', async () => {
    // Rejected attempts must not be recorded, or a script hammering the endpoint would
    // hold itself blocked forever and the window would never drain.
    const limited = createRateLimiter({ windowMs: 60, max: 1 });
    limited('4.4.4.4');
    for (let i = 0; i < 5; i++) limited('4.4.4.4');
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(limited('4.4.4.4'), 0);
  });
});

describe('lockout', () => {
  test('the third consecutive failure locks, and says for how long', () => {
    const lockout = createLockout({ maxFailures: 3, lockMs: 30_000 });
    assert.equal(lockout.fail('1.2.3.4'), 0, 'one mistype is free');
    assert.equal(lockout.fail('1.2.3.4'), 0, 'so is two');
    assert.equal(lockout.fail('1.2.3.4'), 30, 'the third locks for thirty seconds');
    assert.equal(lockout.lockedFor('1.2.3.4'), 30);
  });

  test('a success clears the count', () => {
    const lockout = createLockout({ maxFailures: 3, lockMs: 30_000 });
    lockout.fail('5.5.5.5');
    lockout.fail('5.5.5.5');
    lockout.clear('5.5.5.5');
    assert.equal(lockout.fail('5.5.5.5'), 0, 'back to the first strike');
    assert.equal(lockout.lockedFor('5.5.5.5'), 0);
  });

  test('counts each address separately', () => {
    const lockout = createLockout({ maxFailures: 2, lockMs: 30_000 });
    lockout.fail('6.6.6.6');
    assert.ok(lockout.fail('6.6.6.6') > 0, 'first address is locked');
    assert.equal(lockout.lockedFor('7.7.7.7'), 0, 'a different address is unaffected');
  });

  test('the lock expires and the count starts over', async () => {
    // Three fresh tries after waiting it out, not one-and-locked-again: a lock that re-arms
    // on the first slip after it lifts leaves the owner one mistype from another thirty
    // seconds, indefinitely.
    const lockout = createLockout({ maxFailures: 2, lockMs: 40 });
    lockout.fail('8.8.8.8');
    assert.ok(lockout.fail('8.8.8.8') > 0);
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(lockout.lockedFor('8.8.8.8'), 0, 'the lock has lifted');
    assert.equal(lockout.fail('8.8.8.8'), 0, 'and the count went back to zero');
  });

  test('retrying while locked does not extend the lock', async () => {
    const lockout = createLockout({ maxFailures: 1, lockMs: 60 });
    lockout.fail('9.9.9.9');
    for (let i = 0; i < 5; i++) lockout.fail('9.9.9.9');
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(lockout.lockedFor('9.9.9.9'), 0, 'a script cannot hold itself locked forever');
  });

  test('rounds the remaining time up, so it never reads zero while still locked', () => {
    // A countdown that shows "0 seconds" for the last fraction of a second reads as a bug
    // to the person watching it.
    const lockout = createLockout({ maxFailures: 1, lockMs: 1200 });
    assert.equal(lockout.fail('10.10.10.10'), 2);
  });
});
