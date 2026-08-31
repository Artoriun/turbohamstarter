import assert from 'node:assert/strict';
import { describe as suite, test } from 'node:test';
import {
  allSlides,
  type CarouselSlide,
  describe,
  findSlide,
  metaForRoute,
  ROUTES,
  SECTIONS,
  type Section,
  SITE_DESCRIPTION,
  SITE_TITLE,
  sectionsForPage,
  splitOnMascot,
} from './index';

/**
 * The prerenderer and the client both call metaForRoute, so a change here moves both
 * the static HTML a crawler reads and the title a client-side navigation lands on.
 * They have to agree: if they drift, the tab title changes for no reason as the user
 * navigates.
 */

const section = (over: Partial<Section> = {}): Section => ({
  id: 's1',
  page: 'home',
  heading: 'Heading',
  body: 'Body text',
  ...over,
});

const slide = (over: Partial<CarouselSlide> = {}): CarouselSlide => ({
  id: 'slide-1',
  heading: 'Slide heading',
  body: 'Slide body',
  ...over,
});

suite('sectionsForPage', () => {
  test('keeps only the requested page', () => {
    const all = [section(), section({ id: 's2', page: 'about' })];
    assert.deepEqual(
      sectionsForPage('home', all).map((s) => s.id),
      ['s1'],
    );
  });

  test('drops soft-deleted sections', () => {
    const all = [section(), section({ id: 's2', deleted: true })];
    assert.deepEqual(
      sectionsForPage('home', all).map((s) => s.id),
      ['s1'],
    );
  });

  test('sorts by order, and treats a missing order as 0', () => {
    const all = [
      section({ id: 'c', order: 2 }),
      section({ id: 'a' }),
      section({ id: 'b', order: 1 }),
    ];
    assert.deepEqual(
      sectionsForPage('home', all).map((s) => s.id),
      ['a', 'b', 'c'],
    );
  });
});

suite('describe', () => {
  test('collapses whitespace to one line', () => {
    const text = describe('first line\nsecond   line', 'fallback');
    assert.equal(text, 'first line second line');
    assert.ok(!text.includes('\n'), 'a meta description cannot contain newlines');
  });

  test('caps at roughly a search snippet and marks the cut', () => {
    const text = describe('word '.repeat(200), 'fallback');
    assert.ok(text.length <= 155, `was ${text.length}`);
    assert.ok(text.endsWith('…'));
    assert.ok(!text.endsWith(' …'), 'trailing space should be trimmed before the ellipsis');
  });

  test('falls back when there is no text', () => {
    for (const empty of ['', '   \n  ']) assert.equal(describe(empty, 'fallback'), 'fallback');
  });
});

suite('metaForRoute', () => {
  test('ignores a trailing slash, which is the form the prerenderer writes', () => {
    assert.deepEqual(metaForRoute('/about/'), metaForRoute('/about'));
    assert.deepEqual(metaForRoute('/'), metaForRoute(''));
  });

  test('every prerendered route has its own title, so none share one', () => {
    const titles = ROUTES.map((r) => metaForRoute(r).title);
    assert.equal(new Set(titles).size, ROUTES.length, `duplicate title among ${titles}`);
  });

  test('an unknown route falls back to the site defaults', () => {
    const meta = metaForRoute('/nonsense');
    assert.equal(meta.title, SITE_TITLE);
    assert.equal(meta.description, SITE_DESCRIPTION);
  });

  test('the home description comes from the first section, so editing it updates SEO', () => {
    const custom = [section({ id: 'hero', body: 'A distinctive sentence.', order: 0 })];
    assert.equal(metaForRoute('/', custom).description, 'A distinctive sentence.');
  });

  test('the home description skips a carousel section even if it sorts first', () => {
    const custom = [
      section({ id: 'home-carousel', kind: 'carousel', body: '', order: -1, slides: [] }),
      section({ id: 'hero', body: 'A distinctive sentence.', order: 0 }),
    ];
    assert.equal(metaForRoute('/', custom).description, 'A distinctive sentence.');
  });

  test('admin has a title but no description, because it must not be a search landing page', () => {
    const meta = metaForRoute('/admin');
    assert.ok(meta.title.length > 0);
    assert.equal(meta.description, '');
  });

  test('every bundled route produces a non-empty, length-capped description', () => {
    for (const route of ROUTES) {
      const { title, description } = metaForRoute(route);
      assert.ok(title.length > 0, `empty title for ${route}`);
      assert.ok(description.trim().length > 0, `empty description for ${route}`);
      assert.ok(description.length <= 160, `description too long for ${route}`);
    }
  });

  test('the bundled fallback content is usable as shipped', () => {
    assert.ok(SECTIONS.length > 0);
    assert.ok(sectionsForPage('home').length > 0, 'the home page would render empty');
  });

  test("a project route resolves to that slide's heading and body", () => {
    const carousel = [
      section({
        id: 'c1',
        kind: 'carousel',
        slides: [slide({ id: 'p1', heading: 'Wheel', body: 'Turns.' })],
      }),
    ];
    const meta = metaForRoute('/projects/p1', carousel);
    assert.equal(meta.title, `Wheel | ${SITE_TITLE}`);
    assert.equal(meta.description, 'Turns.');
  });

  test('a project route localises heading and body like any other slide', () => {
    const carousel = [
      section({
        id: 'c1',
        kind: 'carousel',
        slides: [
          slide({
            id: 'p1',
            heading: 'Wheel',
            body: 'Turns.',
            translations: { ja: { heading: '車輪', body: '回る。' } },
          }),
        ],
      }),
    ];
    const meta = metaForRoute('/projects/p1', carousel, 'ja');
    assert.equal(meta.title, `車輪 | ${SITE_TITLE}`);
    assert.equal(meta.description, '回る。');
  });

  test('an unknown project id falls back to the site defaults rather than a broken title', () => {
    const carousel = [section({ id: 'c1', kind: 'carousel', slides: [slide({ id: 'p1' })] })];
    const meta = metaForRoute('/projects/does-not-exist', carousel);
    assert.equal(meta.title, SITE_TITLE);
    assert.equal(meta.description, SITE_DESCRIPTION);
  });
});

suite('allSlides / findSlide', () => {
  test('allSlides collects slides across every carousel section, skipping deleted ones', () => {
    const sections = [
      section({ id: 'c1', kind: 'carousel', slides: [slide({ id: 'a' }), slide({ id: 'b' })] }),
      section({ id: 'c2', kind: 'carousel', deleted: true, slides: [slide({ id: 'z' })] }),
      section({ id: 'text', slides: undefined }),
    ];
    assert.deepEqual(
      allSlides(sections).map((s) => s.id),
      ['a', 'b'],
    );
  });

  test('findSlide finds a slide by id regardless of which section it lives in', () => {
    const sections = [section({ id: 'c1', kind: 'carousel', slides: [slide({ id: 'target' })] })];
    assert.equal(findSlide('target', sections)?.id, 'target');
    assert.equal(findSlide('missing', sections), undefined);
  });
});

suite('the home carousel', () => {
  test('ROUTES carries a /projects/:id entry for every bundled slide', () => {
    const projectRoutes = ROUTES.filter((r) => r.startsWith('/projects/'));
    assert.deepEqual(
      projectRoutes.sort(),
      allSlides()
        .map((s) => `/projects/${s.id}`)
        .sort(),
    );
  });

  test('every bundled slide has a heading and a non-empty body', () => {
    const slides = allSlides();
    assert.ok(slides.length > 0, 'the home carousel would render empty');
    for (const s of slides) {
      assert.ok(s.heading.length > 0, `${s.id} has no heading`);
      assert.ok(s.body.trim().length > 0, `${s.id} has no body`);
    }
  });

  test('the bundled carousel section itself has no page of its own to render empty', () => {
    const carousel = sectionsForPage('home').find((s) => s.kind === 'carousel');
    assert.ok(carousel, 'no carousel section found on home');
  });
});

suite('splitOnMascot', () => {
  test('splits on a standalone mention', () => {
    assert.deepEqual(splitOnMascot('Like TurboHam, it runs on nothing.'), [
      'Like ',
      ', it runs on nothing.',
    ]);
  });

  test('leaves the product name alone', () => {
    // The whole reason the boundaries are there. TurboHamstarter is the product; TurboHam is
    // the animal. Matching without \b turns the brand into a mascot reference on every page.
    assert.deepEqual(splitOnMascot('TurboHamstarter ships with everything.'), [
      'TurboHamstarter ships with everything.',
    ]);
  });

  test('handles both in one string', () => {
    const parts = splitOnMascot('TurboHamstarter, named after TurboHam.');
    assert.equal(parts.length, 2, 'exactly one mention should split');
    assert.equal(parts[0], 'TurboHamstarter, named after ');
  });

  test('text without a mention comes back untouched', () => {
    assert.deepEqual(splitOnMascot('No mascot here.'), ['No mascot here.']);
  });

  test('a possessive or hyphenated form still counts', () => {
    assert.equal(splitOnMascot("TurboHam's cheeks").length, 2);
    assert.equal(splitOnMascot('TurboHam-shaped').length, 2);
  });
});
