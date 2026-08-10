import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Poem } from '@gedichtenv2/shared';
import { mergePoemPatch } from './poemPatch';

/**
 * This runs before React's first render, and its result has to match what the prerenderer
 * put in the HTML. When it does not, React discards the prerendered markup and rebuilds the
 * DOM — the page still works, so the failure is silent and only shows up as a flash.
 */

const poem = (id: string, over: Partial<Poem> = {}): Poem =>
  ({ id, title: id, image: `${id}.jpg`, overlay: `text of ${id}`, ...over }) as Poem;

const BUNDLED = [poem('a'), poem('b'), poem('c')];
const ids = (poems: Poem[]) => poems.map((p) => p.id);

describe('mergePoemPatch', () => {
  test('without a patch, returns the bundled poems', () => {
    assert.deepEqual(ids(mergePoemPatch(BUNDLED)), ['a', 'b', 'c']);
  });

  test('drops poems the bundle marks deleted', () => {
    const withDeleted = [...BUNDLED, poem('gone', { deleted: true })];
    assert.deepEqual(ids(mergePoemPatch(withDeleted)), ['a', 'b', 'c']);
  });

  test('applies the live order', () => {
    const merged = mergePoemPatch(BUNDLED, { order: ['c', 'a', 'b'], changed: [] });
    assert.deepEqual(ids(merged), ['c', 'a', 'b']);
  });

  test('replaces the content of a poem edited in the admin portal', () => {
    const merged = mergePoemPatch(BUNDLED, {
      order: ['a', 'b', 'c'],
      changed: [poem('b', { title: 'Edited', overlay: 'new text' })],
    });
    assert.equal(merged[1].title, 'Edited');
    assert.equal(merged[1].overlay, 'new text');
    assert.equal(merged[0].title, 'a', 'untouched poems keep the bundled copy');
  });

  test('adds a poem created after the bundle was built', () => {
    const merged = mergePoemPatch(BUNDLED, {
      order: ['a', 'b', 'c', 'd'],
      changed: [poem('d')],
    });
    assert.deepEqual(ids(merged), ['a', 'b', 'c', 'd']);
  });

  test('drops a poem deleted after the bundle was built', () => {
    // Arrives as a changed entry carrying the deleted flag, not as an omission from order.
    const merged = mergePoemPatch(BUNDLED, {
      order: ['a', 'b', 'c'],
      changed: [poem('b', { deleted: true })],
    });
    assert.deepEqual(ids(merged), ['a', 'c']);
  });

  test('order is authoritative: an id it omits does not appear', () => {
    assert.deepEqual(ids(mergePoemPatch(BUNDLED, { order: ['a'], changed: [] })), ['a']);
  });

  test('an id in order with no poem behind it is skipped, not left as a hole', () => {
    // A hole would be undefined in the array and crash the first .map over it.
    const merged = mergePoemPatch(BUNDLED, { order: ['a', 'ghost', 'c'], changed: [] });
    assert.deepEqual(ids(merged), ['a', 'c']);
    assert.ok(merged.every(Boolean));
  });

  test('does not mutate the bundled array it was given', () => {
    const input = [poem('a'), poem('b')];
    const snapshot = JSON.stringify(input);
    mergePoemPatch(input, { order: ['b', 'a'], changed: [poem('a', { title: 'X' })] });
    assert.equal(JSON.stringify(input), snapshot, 'the module-level POEMS import is shared');
  });
});
