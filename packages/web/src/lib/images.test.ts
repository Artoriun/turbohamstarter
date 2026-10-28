import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FULL_BLEED_W, fullBleedSrcSet, optimizeUrl } from './images';

/**
 * These transforms are the difference between a 1.2MB PNG and a ~40KB WebP, and a mistake is
 * invisible: a URL that silently fails to match still loads the image, just the original one.
 * The CI byte budget catches it in aggregate, these pin the behaviour.
 */

const CLOUDINARY = 'https://res.cloudinary.com/dgk299isx/image/upload/v1234/photo_abc.png';

describe('optimizeUrl', () => {
  test('injects format, quality and width', () => {
    assert.equal(
      optimizeUrl(CLOUDINARY, 400),
      'https://res.cloudinary.com/dgk299isx/image/upload/f_auto,q_auto,w_400/v1234/photo_abc.png',
    );
  });

  test('defaults to the grid card width', () => {
    assert.ok(optimizeUrl(CLOUDINARY).includes('w_400'));
  });

  test('leaves URLs it cannot resize untouched', () => {
    // The admin file picker shows a blob: preview before upload, and the placeholder is a
    // local asset. Rewriting either produces a broken image rather than a slow one.
    for (const url of ['blob:http://localhost:3000/abc-123', '/placeholder.jpg', '']) {
      assert.equal(optimizeUrl(url, 800), url);
    }
  });

  test('takes a raw URL: applying it twice chains transforms rather than replacing', () => {
    // Not idempotent, and deliberately not made so — every caller passes a raw section.image
    // and check-budgets.mjs enforces that. Pinned here so the constraint is visible: a
    // second call would resize to the first width and then upscale to the second.
    const twice = optimizeUrl(optimizeUrl(CLOUDINARY, 640), 1600);
    assert.equal(twice.match(/w_/g)?.length, 2, 'if this changes, optimizeUrl gained a guard');
  });
});

describe('fullBleedSrcSet', () => {
  test('offers ascending candidates, each with its own width descriptor', () => {
    const entries = fullBleedSrcSet(CLOUDINARY).split(', ');
    const widths = entries.map((e) => Number(e.split(' ')[1].replace('w', '')));
    assert.deepEqual(
      widths,
      [...widths].sort((a, b) => a - b),
      'must ascend',
    );
    assert.equal(new Set(widths).size, widths.length, 'no duplicate candidates');
    for (const entry of entries) {
      const [url, descriptor] = entry.split(' ');
      assert.ok(url.includes(`w_${descriptor.replace('w', '')}/`), `${entry} must agree`);
    }
  });

  test('tops out at the full-bleed width, so no candidate exceeds what we upload', () => {
    const widths = fullBleedSrcSet(CLOUDINARY)
      .split(', ')
      .map((e) => Number(e.split(' ')[1].replace('w', '')));
    assert.equal(Math.max(...widths), FULL_BLEED_W);
  });

  test('is empty for URLs that cannot be resized, so the plain src wins', () => {
    assert.equal(fullBleedSrcSet('blob:http://localhost:3000/abc'), '');
  });
});
