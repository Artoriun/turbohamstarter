import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { createGzip } from 'node:zlib';

/**
 * Serves a built `dist` the way GitHub Pages does: mounted at a base path, gzipping text,
 * hashed assets with a real cache lifetime, and 404.html for anything missing.
 *
 * Extracted so there is one of these rather than two — check-lighthouse.mjs had it inline,
 * and running the Playwright suite against the built output needs exactly the same server.
 * That second use is the point: the dev server applies no base path at all (vite.config.ts
 * only sets it when NODE_ENV is production), so nothing in the suite has ever exercised the
 * path the site is actually deployed under.
 */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.xml', '.txt']);

export function createStaticServer({ dist, basePath = '/' }) {
  const BASE = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const DIST = dist;
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    // Both the base-prefixed URL and the bare one resolve to the same file. Playwright's
    // baseURL cannot carry a path for these specs: `page.goto('/about')` is root-absolute,
    // so the base is discarded and every route would 404 — while assets, which the built
    // HTML references with the base baked in, need the prefix. Serving both keeps the suite
    // testing the real built output without rewriting every goto in it.
    if (path.startsWith(BASE)) path = path.slice(BASE.length);
    else path = path.replace(/^\//, '');
    // normalize collapses any ../ before it can escape DIST.
    let file = join(DIST, normalize(`/${path}`));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      // Same fallback GitHub Pages uses, so an unexpected 404 in the audit is a real one.
      res.writeHead(404, { 'Content-Type': 'text/html' });
      createReadStream(join(DIST, '404.html')).pipe(res);
      return;
    }
    const gzip =
      COMPRESSIBLE.has(extname(file)) && (req.headers['accept-encoding'] ?? '').includes('gzip');
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      // Pages serves hashed assets with a real lifetime; without this the audit reports a
      // caching problem that only exists in this script.
      'Cache-Control': 'public, max-age=600',
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    });
    const stream = createReadStream(file);
    if (gzip) stream.pipe(createGzip()).pipe(res);
    else stream.pipe(res);
  });
}

/** Resolves once listening, or exits with a readable message if the port is taken. */
export async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once('error', (err) =>
      reject(err.code === 'EADDRINUSE' ? new Error(`port ${port} is already in use`) : err),
    );
    server.listen(port, resolve);
  }).catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
