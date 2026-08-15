import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRateLimiter } from './rateLimit';

describe('rate limiter', () => {
  test('allows up to max, then blocks', () => {
    const limited = createRateLimiter({ windowMs: 60_000, max: 3 });
    assert.deepEqual(
      [1, 2, 3, 4, 5].map(() => limited('1.2.3.4')),
      [false, false, false, true, true],
    );
  });

  test('counts each address separately', () => {
    const limited = createRateLimiter({ windowMs: 60_000, max: 2 });
    limited('1.1.1.1');
    limited('1.1.1.1');
    assert.equal(limited('1.1.1.1'), true, 'first address is spent');
    assert.equal(limited('2.2.2.2'), false, 'a different address is unaffected');
  });

  test('the window expires', async () => {
    const limited = createRateLimiter({ windowMs: 40, max: 1 });
    assert.equal(limited('3.3.3.3'), false);
    assert.equal(limited('3.3.3.3'), true);
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(limited('3.3.3.3'), false, 'allowed again once the window has passed');
  });

  test('a blocked caller does not extend its own block by retrying', async () => {
    // Rejected attempts must not be recorded, or a script hammering the endpoint would
    // hold itself blocked forever and the window would never drain.
    const limited = createRateLimiter({ windowMs: 60, max: 1 });
    limited('4.4.4.4');
    for (let i = 0; i < 5; i++) limited('4.4.4.4');
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(limited('4.4.4.4'), false);
  });
});
