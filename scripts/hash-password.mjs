#!/usr/bin/env node
/**
 * Prints an ADMIN_PASSWORD_HASH for a password you type in.
 *
 *   npm run hash-password
 *
 * Set the result as ADMIN_PASSWORD_HASH on Render, confirm you can still log in, then
 * remove ADMIN_PASSWORD. The password itself does not change — only where the server keeps
 * the thing it compares against, so the plaintext no longer sits in the dashboard.
 *
 * Reads from a prompt rather than argv so the password does not end up in shell history.
 */
import { createInterface } from 'node:readline';
import { hashPassword } from '../packages/api/src/password.ts';

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

// Suppress echo while typing.
const ask = (q) =>
  new Promise((resolve) => {
    process.stdout.write(q);
    const onData = (ch) => {
      if (['\n', '\r', ''].includes(ch.toString())) process.stdin.removeListener('data', onData);
      else process.stdout.write('*');
    };
    process.stdin.on('data', onData);
    rl.question('', (answer) => {
      process.stdout.write('\n');
      resolve(answer);
    });
  });

const password = await ask('Admin password: ');
rl.close();

if (!password) {
  console.error('No password entered.');
  process.exit(1);
}
if (password.length < 12) {
  console.warn(
    `\n! ${password.length} characters. One password guards every poem in the portal; longer is better.`,
  );
}

console.log('\nSet this on Render, then remove ADMIN_PASSWORD once login is confirmed:\n');
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}\n`);
