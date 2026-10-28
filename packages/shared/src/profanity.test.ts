import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEFAULT_BLOCKLIST, findProfanity, hasProfanity } from './index';

/**
 * The failure mode worth testing here is not "does it catch a rude word" — it is "does it
 * refuse a legitimate sentence". A filter with false positives gets switched off, and then
 * it protects nothing.
 */

describe('findProfanity', () => {
  test('finds a blocklisted word', () => {
    const found = findProfanity('what a load of bollocks');
    assert.equal(found.length, 1);
    assert.equal(found[0].word, 'bollocks');
  });

  test('is case-insensitive', () => {
    for (const text of ['SHIT', 'Shit', 'sHiT']) {
      assert.equal(findProfanity(text).length, 1, `missed ${text}`);
    }
  });

  test('reports where the match is, so a caller can point at it', () => {
    const [match] = findProfanity('oh damn it');
    assert.equal(match.index, 3);
  });

  test('finds several, in the order they appear', () => {
    const found = findProfanity('damn this crap');
    assert.deepEqual(
      found.map((m) => m.word),
      ['damn', 'crap'],
    );
  });

  describe('does not match inside a longer word — the Scunthorpe problem', () => {
    // Every one of these contains a blocklisted string. A substring check flags all of
    // them, and the site owner discovers it when they cannot save the word "classic".
    const innocent = [
      'Scunthorpe',
      'Penistone',
      'assess the damage',
      'a classic design',
      'cockatoo',
      'Arsenal',
      'crappie fishing', // 'crap' + suffix
      'bastardised', // suffixed
      'shiitake mushrooms',
      'therapist',
      'analysis',
    ];
    for (const text of innocent) {
      test(text, () => {
        assert.deepEqual(findProfanity(text), [], `${text} was wrongly flagged`);
      });
    }
  });

  test('still matches next to punctuation, where a naive \\b would not', () => {
    for (const text of ['damn!', '(damn)', 'oh, damn.', '"damn"', 'damn—really']) {
      assert.equal(findProfanity(text).length, 1, `missed ${text}`);
    }
  });

  test('an empty list falls back to the default rather than matching nothing', () => {
    // The stored settings use [] to mean "no custom list", and the portal sends [] the
    // moment someone clears the field. Reading that as an explicit empty list left the
    // filter on and silently inert.
    assert.equal(findProfanity('damn', []).length, 1);
    assert.equal(findProfanity('damn', undefined).length, 1);
  });

  test('empty text matches nothing', () => {
    assert.deepEqual(findProfanity(''), []);
  });

  test('a custom blocklist replaces the default rather than extending it', () => {
    assert.deepEqual(findProfanity('damn', ['bananas']), []);
    assert.equal(findProfanity('bananas', ['bananas']).length, 1);
  });

  test('a regex character in a custom entry is treated literally, not as a pattern', () => {
    // Without escaping this throws, or worse, matches everything.
    assert.doesNotThrow(() => findProfanity('anything', ['c++', 'a(b']));
    assert.equal(findProfanity('I write c++ daily', ['c++']).length, 1);
  });

  test('handles non-ASCII letters as letters, so accents do not create a boundary', () => {
    // 'damné' is a word in its own right; the boundary must not fall between n and é.
    assert.deepEqual(findProfanity('damné'), []);
  });

  test('the shipped list is lowercase and free of duplicates', () => {
    for (const w of DEFAULT_BLOCKLIST) assert.equal(w, w.toLowerCase(), `${w} is not lowercase`);
    assert.equal(new Set(DEFAULT_BLOCKLIST).size, DEFAULT_BLOCKLIST.length);
  });
});

describe('hasProfanity', () => {
  test('answers the yes/no the API needs', () => {
    assert.equal(hasProfanity('perfectly fine'), false);
    assert.equal(hasProfanity('damn'), true);
  });
});
