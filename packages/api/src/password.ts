import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Admin password verification.
 *
 * Prefers a stored scrypt hash (ADMIN_PASSWORD_HASH) so the hosting dashboard and any
 * leaked log no longer contain the password itself. Falls back to comparing the plaintext
 * ADMIN_PASSWORD, which is how this started — so the existing password keeps working with
 * no change, and the hash can be adopted whenever it suits.
 *
 * scrypt rather than bcrypt or argon2 because it is in Node's standard library: one admin
 * password does not justify a native dependency in the deploy.
 */

const SCHEME = 'scrypt';
const KEY_LEN = 64;

/** `scrypt$<salt-hex>$<key-hex>`. Generate with `npm run hash-password`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LEN);
  return `${SCHEME}$${salt.toString('hex')}$${key.toString('hex')}`;
}

function verifyHashed(password: string, stored: string): boolean {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== SCHEME || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length !== KEY_LEN) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), KEY_LEN);
  return timingSafeEqual(actual, expected);
}

/**
 * Constant time in both branches. `a !== b` returns as soon as two bytes differ, which
 * leaks how much of a guess was right; hashing first also keeps the operands a fixed
 * length, so the comparison cannot leak the password's length either.
 */
function verifyPlaintext(password: string, expected: string): boolean {
  const a = createHash('sha256').update(password).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function verifyAdminPassword(password: string): boolean {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return verifyHashed(password, hash);
  const plain = process.env.ADMIN_PASSWORD;
  return plain ? verifyPlaintext(password, plain) : false;
}

/** True when either form of the secret is configured. */
export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD);
}

/** True when still relying on the plaintext form, so startup can say so once. */
export function usingPlaintextPassword(): boolean {
  return !process.env.ADMIN_PASSWORD_HASH && Boolean(process.env.ADMIN_PASSWORD);
}
