import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { describePoem, hasPageBreak, PAGE_BREAK, splitPages, stripPageBreaks } from './index';

/**
 * Author-placed page breaks.
 *
 * The marker is two literal characters, so the tests build their input with PAGE_BREAK
 * rather than writing `\\n` and hoping the escaping is right.
 */

describe('splitPages', () => {
  test('a poem without markers is one page — every poem that predates the feature', () => {
    assert.deepEqual(splitPages('one\ntwo\nthree'), ['one\ntwo\nthree']);
  });

  test('empty stays empty rather than becoming a page of nothing', () => {
    assert.deepEqual(splitPages(''), ['']);
  });

  test('a marker on its own line breaks there', () => {
    assert.deepEqual(splitPages(`one\ntwo\n${PAGE_BREAK}\nthree\nfour`), [
      'one\ntwo',
      'three\nfour',
    ]);
  });

  test('a marker at the end of a line breaks the same way', () => {
    // The two are indistinguishable to whoever is typing, so they must behave alike.
    assert.deepEqual(splitPages(`one\ntwo${PAGE_BREAK}\nthree`), ['one\ntwo', 'three']);
  });

  test('several markers give several pages', () => {
    assert.deepEqual(splitPages(`a${PAGE_BREAK}b${PAGE_BREAK}c`), ['a', 'b', 'c']);
  });

  test('stray markers do not produce blank pages', () => {
    // Leading, trailing and doubled: all easy to type by accident, none should page onto
    // an empty screen.
    assert.deepEqual(splitPages(`${PAGE_BREAK}a${PAGE_BREAK}${PAGE_BREAK}b${PAGE_BREAK}`), [
      'a',
      'b',
    ]);
  });

  test('an overlay of nothing but markers still renders as something', () => {
    assert.deepEqual(splitPages(`${PAGE_BREAK}${PAGE_BREAK}`), ['']);
  });

  test('blank lines inside a page are kept — they are stanza breaks', () => {
    assert.deepEqual(splitPages(`a\n\nb${PAGE_BREAK}c`), ['a\n\nb', 'c']);
  });
});

describe('stripPageBreaks', () => {
  test('leaves an unmarked poem exactly as it was', () => {
    const poem = 'one\n\ntwo\nthree';
    assert.equal(stripPageBreaks(poem), poem);
  });

  test('removes the marker without leaving a blank line behind', () => {
    assert.equal(stripPageBreaks(`one\n${PAGE_BREAK}\ntwo`), 'one\ntwo');
    assert.equal(stripPageBreaks(`one${PAGE_BREAK}two`), 'one\ntwo');
  });

  test('no marker survives, wherever it sits', () => {
    for (const input of [
      `${PAGE_BREAK}a`,
      `a${PAGE_BREAK}`,
      `a${PAGE_BREAK}${PAGE_BREAK}b`,
      `a\n${PAGE_BREAK}\nb\n${PAGE_BREAK}\nc`,
    ]) {
      assert.ok(
        !stripPageBreaks(input).includes(PAGE_BREAK),
        `marker survived in ${JSON.stringify(input)}`,
      );
    }
  });
});

describe('hasPageBreak', () => {
  test('distinguishes a marked poem from a plain one', () => {
    assert.equal(hasPageBreak('one\ntwo'), false);
    assert.equal(hasPageBreak(`one${PAGE_BREAK}two`), true);
  });
});

describe('describePoem', () => {
  test('never advertises a marker in a search result', () => {
    // The meta description is the one leak that would be invisible in the browser and
    // visible on Google.
    const description = describePoem({
      id: 'x',
      title: 'Test',
      image: '',
      overlay: `Első sor${PAGE_BREAK}Második sor`,
    });
    assert.ok(!description.includes(PAGE_BREAK), `marker leaked: ${description}`);
    assert.equal(description, 'Első sor Második sor');
  });
});
