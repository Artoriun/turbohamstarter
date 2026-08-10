import { stripPageBreaks } from '@gedichtenv2/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PoemReader from '../components/PoemReader';
import { usePoemsContext } from '../context/PoemsContext';
import { useT } from '../i18n';
import { optimizeUrl } from '../lib/images';
import { IS_PRERENDERED } from '../lib/prerendered';

const PER_PAGE = 9;
const PAGE_FADE_OUT = 400; // ms — must match --page-fade-out-duration in CSS

// Load image URLs into the browser cache, then call done() once (or after 4s, so a
// slow image can't strand a page change). Gates grid page transitions so the incoming
// cards fade in with their images already cached instead of popping in one by one.
function preloadImages(urls: string[], done: () => void) {
  if (urls.length === 0) {
    done();
    return;
  }
  let loaded = 0;
  let finished = false;
  const finish = () => {
    if (!finished) {
      finished = true;
      done();
    }
  };
  for (const url of urls) {
    const img = new Image();
    const bump = () => {
      loaded += 1;
      if (loaded >= urls.length) finish();
    };
    img.onload = bump;
    img.onerror = bump;
    img.src = url;
  }
  window.setTimeout(finish, 4000);
}

// Card enter/exit variants for the poems grid; custom(i) provides per-card stagger index
const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.2 } }),
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

export default function Poems() {
  const t = useT();
  const { poems, loading } = usePoemsContext();
  const { id } = useParams<{ id: string }>();
  // On a full page reload always start at the first batch — the saved grid state
  // exists only to return the user to their page when coming back from a poem's detail view.
  const isReload =
    typeof performance !== 'undefined' &&
    (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)
      ?.type === 'reload';
  const savedState = !id && !isReload ? sessionStorage.getItem('poems-grid-state') : null;
  const savedParsed = savedState ? JSON.parse(savedState) : null;
  const [page, setPage] = useState<number>(savedParsed?.page ?? 0);
  const navigate = useNavigate();
  const detailPoem = id ? (poems.find((p) => p.id === id) ?? null) : null;
  const activeCardRef = useRef<HTMLElement | null>(null);
  const [activePoemId, setActivePoemId] = useState<string | null>(
    savedParsed?.activePoemId ?? id ?? null,
  );
  const tocListRef = useRef<HTMLUListElement>(null);
  const tocLineRef = useRef<HTMLDivElement>(null);
  const tocDirectionRef = useRef<'down' | 'up'>('down');
  const pulseNavRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Stores a highlight callback to fire after the incoming grid page finishes entering
  const pendingHighlightRef = useRef<(() => void) | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(0);
  // Start settled on a prerendered page — the cards and detail image are already painted
  // in the markup, so beginning un-revealed would render a different tree than the HTML
  // holds and cost us hydration. See lib/prerendered.ts.
  const [revealed, setRevealed] = useState(IS_PRERENDERED);

  // Batch size adapts to how many columns fit the viewport, so a page always fills
  // complete rows and never leaves a single card orphaned on the last row.
  // Uses the multiple of `columns` nearest to PER_PAGE (e.g. 2 cols -> 8, 3 cols -> 9).
  const perPage = (() => {
    if (columns <= 1) return PER_PAGE;
    const lower = Math.floor(PER_PAGE / columns) * columns;
    const upper = Math.ceil(PER_PAGE / columns) * columns;
    return PER_PAGE - lower <= upper - PER_PAGE ? lower : upper;
  })();

  // Measure the grid's real column count (auto-fill resolves to actual tracks)
  // `id` is listed deliberately —
  // remeasuring when the route changes is the point, since the grid unmounts on a detail
  // view and its columns must be read again on return.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the extra dependency is intentional
  useLayoutEffect(() => {
    const measure = () => {
      const g = gridRef.current;
      if (!g) return;
      const cols = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length;
      setColumns((c) => (c === cols ? c : cols));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [id]);

  // If a resize shrinks the page count below the current page, snap back to the first
  useEffect(() => {
    if (poems.length && page * perPage >= poems.length) setPage(0);
  }, [perPage, poems.length, page]);

  const displayed = poems.slice(page * perPage, (page + 1) * perPage);

  // Reveal the grid once — after the data loads and the first visible batch's images
  // are cached — then never re-gate. Latched a single time (like the admin grid's
  // `initialized`) so the cards fade in exactly once, not again when `poems` updates
  // (fallback → API) or an effect re-runs. Page changes animate via AnimatePresence.
  // ponytail: new Image() fires onload even for HTTP-cached URLs, so the reveal is
  // near-instant on a warm cache; the batch's <img> tags then paint from cache.
  useEffect(() => {
    if (revealed || loading || poems.length === 0) return;
    const batch = poems.slice(page * perPage, (page + 1) * perPage);
    if (batch.length === 0) {
      setRevealed(true);
      return;
    }
    let loaded = 0;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setRevealed(true);
      }
    };
    const bump = () => {
      loaded += 1;
      if (loaded >= batch.length) finish();
    };
    const imgs = batch.map((p) => {
      const img = new Image();
      img.onload = bump;
      img.onerror = bump;
      img.src = optimizeUrl(p.image);
      return img;
    });
    const t = setTimeout(finish, 4000); // fallback so a slow image can't hang the grid
    return () => {
      clearTimeout(t);
      for (const img of imgs) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [revealed, loading, poems, page, perPage]);

  useEffect(
    () => () => {
      pulseNavRef.current.forEach(clearTimeout);
    },
    [],
  );

  // Re-apply highlight-static on the active card when returning from detail view
  useEffect(() => {
    if (id || !activePoemId) return;
    const card = document.querySelector<HTMLElement>(`#${activePoemId} .poem-card`);
    if (
      !card ||
      card.classList.contains('poem-highlight') ||
      card.classList.contains('poem-highlight-static')
    )
      return;
    card.classList.add('poem-highlight-static');
    activeCardRef.current = card;
  }, [id, activePoemId]);

  // Keep the TOC indicator line in sync with the current page range
  // activePoemId is listed on
  // purpose — the indicator has to redraw when the highlighted poem changes, not only when
  // the route does.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the extra dependency is intentional
  useEffect(() => {
    const ul = tocListRef.current;
    const line = tocLineRef.current;
    if (!ul || !line) return;
    const nav = ul.parentElement as HTMLElement;

    const firstIndex = page * perPage;
    const lastIndex = Math.min((page + 1) * perPage - 1, poems.length - 1);
    const first = ul.children[firstIndex] as HTMLElement | undefined;
    const last = ul.children[lastIndex] as HTMLElement | undefined;
    if (!first || !last) return;

    const layoutTop = first.offsetTop;
    const height = last.offsetTop + last.offsetHeight - layoutTop;

    // Auto-scroll the nav so the current range is always in view. The first page is a
    // special case: item 0's offsetTop already includes the TOC title above it, so the
    // usual 24px lead-in would scroll down just far enough to clip that title.
    nav.scrollTop = firstIndex === 0 ? 0 : Math.max(0, layoutTop - 24);

    const setTop = () => {
      line.style.top = `${layoutTop - nav.scrollTop}px`;
    };

    setTop();
    line.style.height = `${height}px`;
    line.style.animation = 'none';
    void line.offsetHeight; // force reflow so restarting the same animation actually re-runs
    line.style.animation =
      tocDirectionRef.current === 'down'
        ? 'toc-line-grow-down 0.65s ease forwards'
        : 'toc-line-grow-up 0.65s ease forwards';

    nav.addEventListener('scroll', setTop);

    const ro = new ResizeObserver(() => {
      const f = ul.children[firstIndex] as HTMLElement | undefined;
      const l = ul.children[lastIndex] as HTMLElement | undefined;
      if (!f || !l) return;
      line.style.top = `${f.offsetTop - nav.scrollTop}px`;
      line.style.height = `${l.offsetTop + l.offsetHeight - f.offsetTop}px`;
    });
    ro.observe(ul);
    return () => {
      nav.removeEventListener('scroll', setTop);
      ro.disconnect();
    };
    // poems.length matters: on a cold load the list is empty, so the <li> lookup above
    // bails out and the line is never drawn — it has to redraw once the poems arrive.
  }, [page, id, perPage, poems.length]);

  useEffect(() => {
    if (id) return;
    const onClick = (e: MouseEvent) => {
      if (
        activeCardRef.current &&
        !(e.target as Element).closest('.poem-card, .poems-toc, .site-header')
      ) {
        activeCardRef.current.classList.remove('poem-highlight', 'poem-highlight-static');
        activeCardRef.current = null;
        setActivePoemId(null);
        sessionStorage.removeItem('poems-grid-state');
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [id]);

  // Play the TOC line retract animation; called just before a page change
  const retractTocLine = () => {
    const line = tocLineRef.current;
    if (!line) return;
    line.style.animation = 'none';
    void line.offsetHeight;
    line.style.animation =
      tocDirectionRef.current === 'down'
        ? 'toc-line-retract-down 0.4s ease forwards'
        : 'toc-line-retract-up 0.4s ease forwards';
  };

  // ── Detail page ───────────────────────────────────────────────────────────────

  if (id) {
    if (!detailPoem)
      return loading ? (
        <div className="page poem-detail">
          <p className="loading-prompt detail-loading">{t.poems.loading}</p>
        </div>
      ) : (
        <div className="page">
          <p>{t.poems.notFound}</p>
        </div>
      );
    // Keyed by id so switching poems remounts the reader rather than leaving last poem's
    // pagination and slide index in place. Returning to the grid is handled here because
    // it means restoring the grid's page, which the reader knows nothing about.
    return (
      <PoemReader
        key={detailPoem.id}
        poem={detailPoem}
        onBack={() => {
          const targetPage = Math.floor(poems.findIndex((p) => p.id === id) / perPage);
          sessionStorage.setItem(
            'poems-grid-state',
            JSON.stringify({ page: targetPage, activePoemId: id }),
          );
          navigate('/poems');
        }}
      />
    );
  }

  // ── Grid page ─────────────────────────────────────────────────────────────────

  const handleNextPage = () => {
    const nextPage = (page + 1) * perPage >= poems.length ? 0 : page + 1;
    tocDirectionRef.current = nextPage > page ? 'down' : 'up';
    retractTocLine(); // retract the indicator line before AnimatePresence starts the exit
    if (activeCardRef.current) {
      activeCardRef.current.classList.remove('poem-highlight', 'poem-highlight-static');
      activeCardRef.current = null;
    }
    setActivePoemId(null);
    sessionStorage.removeItem('poems-grid-state');
    // Cache the next batch's images before switching, so the cards fade in smoothly
    const nextUrls = poems
      .slice(nextPage * perPage, (nextPage + 1) * perPage)
      .map((p) => optimizeUrl(p.image));
    preloadImages(nextUrls, () => setPage(nextPage));
  };

  const handleTocClick = (poemId: string) => {
    pulseNavRef.current.forEach(clearTimeout);
    pulseNavRef.current = [];
    document
      .querySelectorAll<HTMLElement>('.poem-card.poem-highlight, .poem-card.poem-highlight-static')
      .forEach((el) => {
        el.classList.remove('poem-highlight', 'poem-highlight-static');
      });
    setActivePoemId(poemId);
    const targetPage = Math.floor(poems.findIndex((p) => p.id === poemId) / perPage);

    // Pulses the card and then navigates to its detail page
    const doHighlight = () => {
      if (activeCardRef.current)
        activeCardRef.current.classList.remove('poem-highlight', 'poem-highlight-static');
      const card = document.querySelector<HTMLElement>(`#${poemId} .poem-card`);
      if (!card) return;
      card.classList.remove('poem-highlight', 'poem-highlight-static');
      void card.offsetWidth;
      card.classList.add('poem-highlight');
      activeCardRef.current = card;
      const wrapper = card.closest<HTMLElement>('.poem-card-wrapper') ?? card;
      const rect = wrapper.getBoundingClientRect();
      const headerHeight =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
        ) || 72;
      if (rect.top < headerHeight) {
        window.scrollBy({ top: rect.top - headerHeight - 16, behavior: 'smooth' });
      } else if (rect.bottom > window.innerHeight) {
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      const rawPulse = getComputedStyle(document.documentElement)
        .getPropertyValue('--pulse-duration')
        .trim();
      const pulseDuration = rawPulse.endsWith('ms')
        ? parseFloat(rawPulse)
        : rawPulse.endsWith('s')
          ? parseFloat(rawPulse) * 1000
          : 2400;
      const t1 = setTimeout(() => {
        document.querySelector('.poems-grid-page')?.classList.add('page-fade-out');
      }, pulseDuration - PAGE_FADE_OUT);
      const t2 = setTimeout(() => {
        sessionStorage.setItem(
          'poems-grid-state',
          JSON.stringify({ page: targetPage, activePoemId: poemId }),
        );
        navigate(`/poems/${poemId}`);
      }, pulseDuration);
      pulseNavRef.current = [t1, t2];
    };

    if (targetPage === page) {
      doHighlight();
      return;
    }

    tocDirectionRef.current = targetPage > page ? 'down' : 'up';
    retractTocLine();
    if (activeCardRef.current) {
      activeCardRef.current.classList.remove('poem-highlight', 'poem-highlight-static');
      activeCardRef.current = null;
    }
    // Queue the highlight to fire after the incoming page finishes entering
    pendingHighlightRef.current = doHighlight;
    // Cache the target batch's images before switching, so the cards fade in smoothly
    const targetUrls = poems
      .slice(targetPage * perPage, (targetPage + 1) * perPage)
      .map((p) => optimizeUrl(p.image));
    preloadImages(targetUrls, () => setPage(targetPage));
  };

  return (
    <div className={`page poems-grid-page${revealed ? ' is-revealed' : ''}`}>
      <div className="poems-layout">
        <div className="poems-toc-wrap">
          <nav className="poems-toc">
            <p className="poems-toc-title">{t.poems.index}</p>
            <ul ref={tocListRef}>
              {poems.map((poem) => (
                <li key={poem.id} className={poem.id === activePoemId ? 'toc-active' : undefined}>
                  <a
                    href={`#${poem.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTocClick(poem.id);
                    }}
                  >
                    {poem.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div ref={tocLineRef} className="toc-range-line" />
        </div>
        <div className="poems-content">
          <h1 className="poems-heading">{t.poems.heading}</h1>
          {/* Always-rendered hidden probe so column count is measurable even while
              the grid is gated behind the loading prompt (avoids a reveal flash) */}
          <div
            ref={gridRef}
            className="poems-grid"
            aria-hidden="true"
            style={{ height: 0, overflow: 'hidden', visibility: 'hidden' }}
          />
          {!revealed ? (
            <motion.p
              className="loading-prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ duration: 0.3 }}
            >
              {t.poems.loading}
            </motion.p>
          ) : (
            <>
              {/* mode="wait" sequences exit then enter so cards never overlap between pages */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={page}
                  className="poems-grid"
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  onAnimationComplete={(definition) => {
                    // Only fire after the enter animation ("show"), not the exit
                    if (definition === 'show' && pendingHighlightRef.current) {
                      pendingHighlightRef.current();
                      pendingHighlightRef.current = null;
                    }
                  }}
                >
                  {displayed.map((poem, i) => (
                    // Each card staggered via the custom prop passed to cardVariants
                    <motion.div
                      key={poem.id}
                      id={poem.id}
                      className="poem-card-wrapper"
                      variants={cardVariants}
                      custom={i}
                    >
                      <div className="poem-card-title">{poem.title}</div>
                      <Link
                        to={`/poems/${poem.id}`}
                        className="poem-card"
                        onClick={() => {
                          pulseNavRef.current.forEach(clearTimeout);
                          pulseNavRef.current = [];
                          document
                            .querySelectorAll<HTMLElement>(
                              '.poem-card.poem-highlight, .poem-card.poem-highlight-static',
                            )
                            .forEach((el) => {
                              el.classList.remove('poem-highlight', 'poem-highlight-static');
                            });
                          sessionStorage.setItem(
                            'poems-grid-state',
                            JSON.stringify({ page, activePoemId: poem.id }),
                          );
                          setActivePoemId(poem.id);
                        }}
                      >
                        <div className="poem-card-img-wrap">
                          <img src={optimizeUrl(poem.image)} alt={poem.title} loading="eager" />
                        </div>
                        {poem.overlay && (
                          <span className="poem-overlay">{stripPageBreaks(poem.overlay)}</span>
                        )}
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
              <button type="button" className="btn-more" onClick={handleNextPage}>
                {t.poems.more}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
