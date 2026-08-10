import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { createGzip } from 'node:zlib';

/**
 * Serves a built `dist` the way GitHub Pages does, for anything that needs to test the
 * production output rather than the dev server.
 *
 * Extracted from check-lighthouse.mjs so there is one of these rather than two: the
 * Playwright run against the built output needs the same server, and two copies of a host
 * emulation drift apart exactly when it matters — when one of them is wrong.
 *
 * Three behaviours are modelled on Pages rather than on convenience:
 *
 * - **The base path.** This site is published under /kov-cs-poetry/, and the bugs that only
 *   exist in that variant (a route resolving outside the base, a 404 where the SPA fallback
 *   should be) are invisible to anything served from the domain root.
 * - **404.html for unmatched paths**, with a 404 status. Returning 200 with index.html would
 *   be friendlier and would hide the routing bugs this exists to catch.
 * - **gzip on text**, because Pages gzips every text response. Without it the Lighthouse
 *   performance number measures a transfer no visitor gets, under a simulated mobile
 *   throttle where it costs real milliseconds. Binary types are already compressed.
 */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

const COMPRESSIBLE = new Set([
  '.html',
  '.js',
  '.css',
  '.svg',
  '.json',
  '.webmanifest',
  '.xml',
  '.txt',
]);

export function createStaticServer({ dist, basePath = '/' }) {
  const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;

  return createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);

    if (prefix !== '/') {
      // `/kov-cs-poetry` without the trailing slash is what a hand-typed URL looks like.
      if (path === prefix.slice(0, -1)) path = prefix;
      // Everything is published under the base path, so anything outside it does not exist
      // as far as this host is concerned. A link that escapes the base must 404 here rather
      // than quietly resolving — that is the whole point of serving it this way.
      if (!path.startsWith(prefix)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 outside base path');
        return;
      }
      path = path.slice(prefix.length - 1);
    }

    // normalize collapses any ../ before it can escape dist.
    let file = join(dist, normalize(`/${path}`));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');

    if (!existsSync(file)) {
      const fallback = join(dist, '404.html');
      if (!existsSync(fallback)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
        return;
      }
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      createReadStream(fallback).pipe(res);
      return;
    }

    const gzip =
      COMPRESSIBLE.has(extname(file)) && (req.headers['accept-encoding'] ?? '').includes('gzip');
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      // Pages serves hashed assets with a real lifetime; without this an audit reports a
      // caching problem that only exists in this script.
      'Cache-Control': 'public, max-age=600',
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    });
    const stream = createReadStream(file);
    if (gzip) stream.pipe(createGzip()).pipe(res);
    else stream.pipe(res);
  });
}

/**
 * Binds the server, refusing to reuse whatever else is on the port.
 *
 * Silently measuring or testing against the wrong server produces a plausible-looking result,
 * which is worse than not running at all — a Playwright run once reported 208 green against a
 * dev server it had reused, having never touched dist.
 */
export function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', (err) =>
      reject(
        err.code === 'EADDRINUSE'
          ? new Error(`port ${port} is already in use — free it, or set the port explicitly`)
          : err,
      ),
    );
    server.listen(port, resolve);
  });
}
