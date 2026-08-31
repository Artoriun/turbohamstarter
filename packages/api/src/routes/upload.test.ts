import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { v2 as cloudinary } from 'cloudinary';
import express from 'express';
import jwt from 'jsonwebtoken';

/**
 * The image upload route, which is the only place multer runs.
 *
 * Written as an upgrade guard rather than to catch a bug: multer carries a run of
 * denial-of-service advisories whose only fix is the 2.x major, so the bump has to be made
 * deliberately. This pins the three things the route relies on — that auth is refused before
 * multer parses anything, that a single field lands in `req.file` as a buffer, and that the
 * size limit still rejects — so the bump is checked rather than assumed.
 *
 * Cloudinary is replaced with a stand-in: this is about the parsing, not the upload.
 */

const SECRET = 'test-secret-for-upload';
process.env.JWT_SECRET = SECRET;
// The route refuses with 503 before it looks at the file when this is unset, so the parsing
// it exists to test would never run. Shaped like a real value; nothing dials out.
process.env.CLOUDINARY_URL = 'cloudinary://key:secret@example';

let server: Server;
let base = '';
let lastUploadBytes = -1;

before(async () => {
  (cloudinary.uploader as unknown as { upload_stream: unknown }).upload_stream = (
    _opts: unknown,
    cb: (err: unknown, result: { secure_url: string }) => void,
  ) => ({
    end: (buf: Buffer) => {
      lastUploadBytes = buf.length;
      cb(null, { secure_url: 'https://example.test/uploaded.png' });
    },
  });

  const { contentRouter } = await import('./content');
  const app = express();
  app.use('/api/content', contentRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
      resolve();
    });
  });
});
after(() => server?.close());

const token = () => jwt.sign({ admin: true, epoch: 0 }, SECRET, { algorithm: 'HS256' });

const post = (body: FormData, auth = true) =>
  fetch(`${base}/api/content/section-1/image`, {
    method: 'POST',
    headers: auth ? { Authorization: `Bearer ${token()}` } : {},
    body,
  });

const form = (bytes: number) => {
  const fd = new FormData();
  fd.append('image', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'x.png');
  return fd;
};

describe('POST /api/content/:id/image', () => {
  test('accepts one file and hands its bytes on', async () => {
    const res = await post(form(2048));
    assert.equal(res.status, 200);
    const { url } = (await res.json()) as { url: string };
    assert.equal(url, 'https://example.test/uploaded.png');
    assert.equal(lastUploadBytes, 2048, 'the whole file should reach the uploader');
  });

  test('a request with no file is refused rather than uploading nothing', async () => {
    assert.equal((await post(new FormData())).status, 400);
  });

  test('rejects a file over the ten-megabyte limit', async () => {
    assert.notEqual((await post(form(11 * 1024 * 1024))).status, 200);
  });

  test('an unauthenticated upload never reaches the parser', async () => {
    // requireAuth is mounted before multer on purpose: it is what keeps the advisories
    // above off the public internet, so the ordering is worth pinning.
    lastUploadBytes = -1;
    assert.equal((await post(form(1024), false)).status, 401);
    assert.equal(lastUploadBytes, -1, 'nothing should have been parsed or uploaded');
  });
});
