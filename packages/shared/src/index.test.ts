import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  describePoem,
  metaForRoute,
  POEMS,
  type Poem,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from './index';

/**
 * The prerenderer and the client both call metaForRoute, so a change here moves both the
 * static HTML a crawler reads and the title a client-side navigation lands on. They have to
 * agree: if they drift, the tab title changes for no reason as the user navigates.
 */

const poem = (over: Partial<Poem> = {}): Poem =>
  ({ id: 'poem-1', title: 'Alkonyat', image: 'a.jpg', overlay: 'Az ég alján', ...over }) as Poem;

describe('describePoem', () => {
  test('uses the poem text, collapsed to one line', () => {
    const text = describePoem(poem({ overlay: 'first line\nsecond   line' }));
    assert.equal(text, 'first line second line');
    assert.ok(!text.includes('\n'), 'a meta description cannot contain newlines');
  });

  test('caps at roughly a search result snippet and marks the cut', () => {
    const text = describePoem(poem({ overlay: 'szó '.repeat(200) }));
    assert.ok(text.length <= 155, `was ${text.length}`);
    assert.ok(text.endsWith('…'));
    assert.ok(!text.endsWith(' …'), 'trailing space should be trimmed before the ellipsis');
  });

  test('leaves a description that already fits alone', () => {
    assert.equal(describePoem(poem({ overlay: 'rövid' })), 'rövid');
  });

  test('falls back to the title when the poem has no text', () => {
    for (const overlay of [undefined, '', '   \n  ']) {
      assert.ok(describePoem(poem({ overlay })).includes('Alkonyat'));
    }
  });
});

describe('metaForRoute', () => {
  const poems = [poem(), poem({ id: 'poem-2', title: 'Éj', overlay: 'Sötét' })];

  test('names the poem on a detail route', () => {
    const { title, description } = metaForRoute('/poems/poem-2', poems);
    assert.equal(title, 'Éj | Kovács');
    assert.equal(description, 'Sötét');
  });

  test('ignores a trailing slash, which is the form the prerenderer writes', () => {
    assert.deepEqual(metaForRoute('/poems/poem-2/', poems), metaForRoute('/poems/poem-2', poems));
    assert.deepEqual(metaForRoute('/poems/', poems), metaForRoute('/poems', poems));
  });

  test('every static route has its own title, so none share one', () => {
    const routes = ['/', '/poems', '/contact', '/privacy', '/admin'];
    const titles = routes.map((r) => metaForRoute(r, poems).title);
    assert.equal(new Set(titles).size, routes.length, `duplicate title among ${titles}`);
  });

  test('an unknown poem falls back to the site title rather than inventing one', () => {
    assert.equal(metaForRoute('/poems/does-not-exist', poems).title, SITE_TITLE);
  });

  test('an unknown route falls back to the site defaults', () => {
    const meta = metaForRoute('/nonsense', poems);
    assert.equal(meta.title, SITE_TITLE);
    assert.equal(meta.description, SITE_DESCRIPTION);
  });

  test('defaults to the bundled poems when none are passed', () => {
    const first = POEMS.find((p) => !p.deleted);
    assert.ok(first, 'the bundle should contain at least one live poem');
    assert.equal(metaForRoute(`/poems/${first.id}`).title, `${first.title} | Kovács`);
  });

  test('every bundled poem produces a non-empty title and description', () => {
    for (const p of POEMS.filter((x) => !x.deleted)) {
      const { title, description } = metaForRoute(`/poems/${p.id}`);
      assert.ok(title.length > 0 && title.includes(p.title), `bad title for ${p.id}`);
      assert.ok(description.trim().length > 0, `empty description for ${p.id}`);
      assert.ok(description.length <= 160, `description too long for ${p.id}`);
    }
  });
});
