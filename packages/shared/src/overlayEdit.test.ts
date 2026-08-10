import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { overlayEdit, PAGE_BREAK } from './index';

/** The admin's edit state, as far as this decision is concerned. */
const state = (overlay: string, customSlidesOpen = false) => ({ overlay, customSlidesOpen });

describe('overlayEdit', () => {
  test('an ordinary edit changes nothing but the text', () => {
    assert.deepEqual(overlayEdit(state('one'), 'one two'), { overlay: 'one two' });
  });

  test('typing the first mark opens Custom Slides on the split', () => {
    const patch = overlayEdit(state('one\ntwo'), `one${PAGE_BREAK}two`);
    assert.equal(patch.customSlidesOpen, true);
    assert.equal(patch.customSlidesEnabled, true);
    assert.deepEqual(patch.customSlides, ['one', 'two']);
  });

  test('with the slides open, a later edit re-splits them', () => {
    const patch = overlayEdit(
      state(`one${PAGE_BREAK}two`, true),
      `one${PAGE_BREAK}two${PAGE_BREAK}three`,
    );
    assert.deepEqual(patch.customSlides, ['one', 'two', 'three']);
  });

  test('closing the slides while marks remain keeps them closed', () => {
    // The trap this rule exists for. Opening whenever a mark is merely present would mean
    // the next keystroke reopened Custom Slides forever, since the marks are still in the
    // text — there would be no way to turn the feature off without deleting them.
    const patch = overlayEdit(state(`one${PAGE_BREAK}two`, false), `one${PAGE_BREAK}two three`);
    assert.deepEqual(patch, { overlay: `one${PAGE_BREAK}two three` });
  });

  test('deleting every mark and typing a new one opens the slides again', () => {
    assert.equal(
      overlayEdit(state('one two', false), `one${PAGE_BREAK}two`).customSlidesOpen,
      true,
    );
  });

  test('an unmarked edit never touches hand-authored slides', () => {
    // Two poems ship with Custom Slides on and no marks. Mirroring unconditionally would
    // collapse them to a single page the moment anyone fixed a typo.
    assert.deepEqual(overlayEdit(state('one\ntwo', true), 'one\ntwo\nthree'), {
      overlay: 'one\ntwo\nthree',
    });
  });

  test('deleting the last mark closes and clears the slides', () => {
    const patch = overlayEdit(state(`one${PAGE_BREAK}two`, true), 'one two');
    assert.equal(patch.customSlidesOpen, false);
    assert.equal(patch.customSlidesEnabled, false);
    assert.equal(patch.customSlides, null);
  });

  test('half-deleting a mark does nothing — the backslash is still there', () => {
    // Deleting `\n` takes two keystrokes. Closing on the first would pull the editor away
    // mid-deletion, so a lone `\` counts as the mark still being present even though it
    // breaks nothing.
    const patch = overlayEdit(state(`one${PAGE_BREAK}two`, true), 'one\\two');
    assert.deepEqual(patch, { overlay: 'one\\two' });
  });

  test('finishing that deletion then closes the slides', () => {
    const patch = overlayEdit(state('one\\two', true), 'one two');
    assert.equal(patch.customSlidesOpen, false);
  });

  test('one mark of several going does not close anything', () => {
    const patch = overlayEdit(state(`a${PAGE_BREAK}b${PAGE_BREAK}c`, true), `a${PAGE_BREAK}b c`);
    assert.equal(patch.customSlidesOpen, undefined, 'should stay open');
    assert.deepEqual(patch.customSlides, ['a', 'b c']);
  });

  test('slides that never had a mark are never closed by an edit', () => {
    // The two poems that ship with Custom Slides on and no marks. Closing on "no mark
    // present" rather than on the transition would delete their slides on any keystroke.
    assert.deepEqual(overlayEdit(state('one\ntwo', true), 'one\ntwo three'), {
      overlay: 'one\ntwo three',
    });
  });

  test('no mark survives into the slides it produces', () => {
    const patch = overlayEdit(state('', false), `a${PAGE_BREAK}b${PAGE_BREAK}c`);
    for (const slide of patch.customSlides ?? []) {
      assert.ok(!slide.includes(PAGE_BREAK), `marker leaked into ${JSON.stringify(slide)}`);
    }
  });
});
