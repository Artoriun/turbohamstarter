import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import {
  adminPasswordConfigured,
  hashPassword,
  usingPlaintextPassword,
  verifyAdminPassword,
} from './password';

const CLEAN = {
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
};
afterEach(() => {
  process.env.ADMIN_PASSWORD = CLEAN.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD_HASH = CLEAN.ADMIN_PASSWORD_HASH;
  if (CLEAN.ADMIN_PASSWORD === undefined) delete process.env.ADMIN_PASSWORD;
  if (CLEAN.ADMIN_PASSWORD_HASH === undefined) delete process.env.ADMIN_PASSWORD_HASH;
});

describe('admin password', () => {
  test('the plaintext form still works, so an existing deployment keeps logging in', () => {
    process.env.ADMIN_PASSWORD = 'existing-password';
    delete process.env.ADMIN_PASSWORD_HASH;
    assert.equal(verifyAdminPassword('existing-password'), true);
    assert.equal(verifyAdminPassword('existing-passwor'), false);
    assert.equal(verifyAdminPassword('EXISTING-PASSWORD'), false);
    assert.equal(usingPlaintextPassword(), true);
  });

  test('the same password verifies against its hash', () => {
    delete process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD_HASH = hashPassword('existing-password');
    assert.equal(verifyAdminPassword('existing-password'), true);
    assert.equal(verifyAdminPassword('something-else'), false);
    assert.equal(usingPlaintextPassword(), false);
  });

  test('the hash does not contain the password and is salted', () => {
    const a = hashPassword('existing-password');
    const b = hashPassword('existing-password');
    assert.ok(!a.includes('existing-password'));
    // Same input, different output: a stolen hash cannot be matched against another
    // installation's by inspection.
    assert.notEqual(a, b);
    assert.match(a, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  test('the hash wins, so a stale plaintext cannot reopen access', () => {
    process.env.ADMIN_PASSWORD = 'old-leaked-password';
    process.env.ADMIN_PASSWORD_HASH = hashPassword('current-password');
    assert.equal(verifyAdminPassword('old-leaked-password'), false);
    assert.equal(verifyAdminPassword('current-password'), true);
  });

  test('nothing configured rejects everything rather than letting anyone in', () => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_HASH;
    assert.equal(adminPasswordConfigured(), false);
    assert.equal(verifyAdminPassword(''), false);
    assert.equal(verifyAdminPassword('anything'), false);
  });

  test('a malformed hash rejects rather than throwing', () => {
    delete process.env.ADMIN_PASSWORD;
    for (const bad of ['', 'garbage', 'scrypt$only-one-part', 'bcrypt$aa$bb', 'scrypt$zz$zz']) {
      process.env.ADMIN_PASSWORD_HASH = bad;
      assert.equal(verifyAdminPassword('current-password'), false, `should reject: ${bad}`);
    }
  });
});
