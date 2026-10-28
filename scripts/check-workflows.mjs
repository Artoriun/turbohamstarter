#!/usr/bin/env node
/**
 * Structural sanity checks on every workflow file, including the two published templates.
 *
 * Nothing validated these. GitHub reports a broken workflow when it tries to run it, which
 * for the publish workflow is the least convenient possible moment, and for the published
 * templates is *after* a snapshot has been pushed to a public repo.
 *
 * Deliberately structural rather than schema validation. A real schema check means a YAML
 * parser and a schema that ages, and every starter user inherits that dependency for a check
 * that catches slips they will make once. These are the mistakes actually available here:
 * a tab (YAML forbids them and the error message is unhelpful), no triggers so the workflow
 * silently never runs, no jobs, a step that neither runs nor uses anything, and unnamed
 * multi-line run blocks, which the log labels with their first line — usually `set -euo
 * pipefail`, which identifies nothing.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const FILES = [
  ...readdirSync(join(ROOT, '.github/workflows'))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => `.github/workflows/${f}`),
  // Only in the monorepo. This script ships to the published starters too, where their own
  // workflow is the only one there is and these paths do not exist.
  ...['react', 'vue']
    .map((t) => `publish/${t}/workflows/ci.yml`)
    .filter((f) => existsSync(join(ROOT, f))),
];

let failures = 0;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failures++;
};

for (const file of FILES) {
  const raw = readFileSync(join(ROOT, file), 'utf8');
  const lines = raw.split('\n');
  let bad = 0;

  const tabs = lines.flatMap((l, i) => (l.includes('\t') ? [i + 1] : []));
  if (tabs.length) {
    fail(`${file}: tab character on line(s) ${tabs.join(', ')} — YAML does not allow them`);
    bad++;
  }

  // `on:` at column 0. A workflow with no triggers never runs and reports nothing.
  if (!/^on:/m.test(raw)) {
    fail(`${file}: no top-level \`on:\` — this workflow would never run`);
    bad++;
  }
  if (!/^jobs:/m.test(raw)) {
    fail(`${file}: no top-level \`jobs:\``);
    bad++;
  }

  // Every `- name:` inside a steps list should be followed by a run or uses before the next
  // step begins. Walking the lines is enough: steps are a flat list at a fixed indent.
  const steps = [];
  let current = null;
  for (const line of lines) {
    const start = line.match(/^(\s+)- (name|uses|run):/);
    if (start) {
      if (current) steps.push(current);
      current = { indent: start[1].length, text: line, hasAction: start[2] !== 'name' };
      continue;
    }
    if (current && /^\s+(run|uses):/.test(line)) current.hasAction = true;
  }
  if (current) steps.push(current);

  const inert = steps.filter((s) => !s.hasAction);
  if (inert.length) {
    fail(`${file}: ${inert.length} step(s) that neither run nor use anything`);
    bad++;
  }

  // Only *multi-line* unnamed runs. A one-liner like `- run: npm ci` renders in the log as
  // "Run npm ci", which needs no help; a `run: |` block renders as its first line, which is
  // usually `set -euo pipefail` and tells a reader nothing about which step just failed.
  const unnamedBlocks = raw.match(/^\s+- run: \|/gm)?.length ?? 0;
  if (unnamedBlocks) {
    fail(
      `${file}: ${unnamedBlocks} unnamed multi-line \`run:\` block(s) — the log labels them with ` +
        'their first line, which is not the step',
    );
    bad++;
  }

  if (!bad) console.log(`✓ ${file} (${steps.length} steps)`);
}

process.exit(failures ? 1 : 0);
