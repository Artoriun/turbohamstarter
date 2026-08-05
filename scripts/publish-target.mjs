#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Assembles a clean, single-frontend snapshot for one of the two public starter repos.
 * Does not push anywhere — that's a separate step once the two destination repos exist,
 * since it force-overwrites a remote's main branch and shouldn't happen by accident.
 *
 * Usage: node scripts/publish-target.mjs <react|vue> [outDir]
 */
const target = process.argv[2];
if (target !== 'react' && target !== 'vue') {
  console.error('Usage: node scripts/publish-target.mjs <react|vue> [outDir]');
  process.exit(1);
}

const ROOT = new URL('..', import.meta.url).pathname;
const outDir = process.argv[3] ?? mkdtempSync(join(tmpdir(), `turbohamstarter-${target}-`));

if (existsSync(outDir) && process.argv[3]) rmSync(outDir, { recursive: true, force: true });

// .env: rsync doesn't know about .gitignore, so without an explicit exclude here
// packages/api's real local secrets get copied onto disk into the scratch assembly
// directory — never actually committed (git respects .gitignore regardless), but there's
// no reason to stage them there in the first place. .env.example is unaffected: it's
// copied separately, explicitly, from the root, not from inside packages/api.
const EXCLUDE = [
  'node_modules',
  'dist',
  '.turbo',
  'test-results',
  '*.tsbuildinfo',
  '.env',
  '.env.*',
];
const rsync = (src, dest) =>
  execFileSync('rsync', ['-a', ...EXCLUDE.flatMap((p) => ['--exclude', p]), `${src}/`, dest], {
    stdio: 'inherit',
  });

// Framework-agnostic packages and repo scaffolding: identical for both targets. Not
// .github — the monorepo's own ci.yml builds and tests both frontends and deploys only
// React; each published repo needs its own single-target version instead (below).
for (const dir of ['packages/shared', 'packages/api', 'scripts', 'e2e', 'docs']) {
  rsync(join(ROOT, dir), join(outDir, dir));
}
// Overlays whatever's target-specific on top of the generic copy above — currently just
// the Lighthouse screenshots, which show real per-framework numbers and can't be shared.
// turboham.gif isn't overridden, so it falls through to the generic copy for both.
if (existsSync(join(ROOT, `publish/${target}/docs`))) {
  rsync(join(ROOT, `publish/${target}/docs`), join(outDir, 'docs'));
}
mkdirSync(join(outDir, '.github/workflows'), { recursive: true });
cpSync(join(ROOT, `publish/${target}/workflows/ci.yml`), join(outDir, '.github/workflows/ci.yml'));
// Issue/PR templates are framework-neutral, so they ride along with the rest of .github/ —
// unlike ci.yml, one shared copy is correct for either target.
cpSync(join(ROOT, '.github/ISSUE_TEMPLATE'), join(outDir, '.github/ISSUE_TEMPLATE'), {
  recursive: true,
});
cpSync(
  join(ROOT, '.github/PULL_REQUEST_TEMPLATE.md'),
  join(outDir, '.github/PULL_REQUEST_TEMPLATE.md'),
);
for (const file of [
  'biome.json',
  'turbo.json',
  'tsconfig.base.json',
  'LICENSE',
  'CONTRIBUTING.md',
  '.gitignore',
  '.nvmrc',
  'playwright.config.ts',
  'render.yaml',
  '.env.example',
]) {
  cpSync(join(ROOT, file), join(outDir, file));
}

// The one frontend this target ships, renamed so packages/web/ is a stable path either way.
const webSrc = target === 'react' ? 'packages/web' : 'packages/web-vue';
rsync(join(ROOT, webSrc), join(outDir, 'packages/web'));

// The Vue package's own package.json still says "@hamstarter/web-vue" post-rename — cosmetic
// (npm workspaces key off the path, not this field) but confusing to anyone reading the
// published repo, so it's corrected to match the folder it now lives in.
const webPkgPath = join(outDir, 'packages/web/package.json');
const webPkg = JSON.parse(readFileSync(webPkgPath, 'utf8'));
webPkg.name = '@hamstarter/web';
writeFileSync(webPkgPath, `${JSON.stringify(webPkg, null, 2)}\n`);

// Per-target root config (name/description differ; everything else is identical, see the
// two files side by side under publish/).
cpSync(join(ROOT, `publish/${target}/package.json`), join(outDir, 'package.json'));

// React's README is accurate as the root README.md (it's the original); Vue gets its own
// edited copy at publish/vue/README.md, since large parts of the original document
// React-specific implementation details.
const readmeOverride = join(ROOT, `publish/${target}/README.md`);
cpSync(
  existsSync(readmeOverride) ? readmeOverride : join(ROOT, 'README.md'),
  join(outDir, 'README.md'),
);

// actions/setup-node's npm cache (both workflows use it) requires a lockfile to key the
// cache on — without one, `npm ci` in CI fails outright before anything else runs.
// --package-lock-only skips writing node_modules, which would just be deleted by
// .gitignore's own node_modules/ entry anyway.
execFileSync('npm', ['install', '--package-lock-only'], { cwd: outDir, stdio: 'inherit' });

console.log(`Assembled ${target} snapshot at ${outDir}`);
