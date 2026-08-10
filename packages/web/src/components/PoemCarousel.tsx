import { stripPageBreaks } from '@gedichtenv2/shared';
import { AnimatePresence, motion } from 'motion/react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePoemsContext } from '../context/PoemsContext';
import { useT } from '../i18n';
import { FULL_BLEED_W, fullBleedSrcSet, optimizeUrl } from '../lib/images';
import { IS_PRERENDERED } from '../lib/prerendered';
import '../styles/global.css';

const PrevArrow = ({ onClick, label }: { onClick?: React.MouseEventHandler; label: string }) => (
  <button
    type="button"
    className="carousel-nav-btn carousel-nav-prev"
    onClick={onClick}
    aria-label={label}
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M11 7H3M7 11l-4-4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
);

const NextArrow = ({ onClick, label }: { onClick?: React.MouseEventHandler; label: string }) => (
  <button
    type="button"
    className="carousel-nav-btn carousel-nav-next"
    onClick={onClick}
    aria-label={label}
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 7h8M7 3l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
);

// Horizontal slide variants; dir 1 = next/right, -1 = prev/left
const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

export default function PoemCarousel() {
  const t = useT();
  const { poems: allPoems, loading } = usePoemsContext();
  // Memoised because both effects below depend on it. Rebuilt every render, it was a new
  // array each time, so listing it as a dependency would have restarted the autoplay timer
  // on every render and the carousel would never have advanced — which is why it was
  // omitted from the dependency lists instead.
  const CAROUSEL_POEMS = useMemo(() => {
    const withOverlay = allPoems.filter((p) => p.overlay);
    const featured = withOverlay.filter((p) => p.featured);
    return featured.length > 0 ? featured : withOverlay.slice(0, 5);
  }, [allPoems]);
  const count = CAROUSEL_POEMS.length;

  // [current index, slide direction] packed together so one setState drives both
  const [[current, direction], setSlide] = useState([0, 0]);
  const [isHovered, setIsHovered] = useState(false);
  // Both start true on a prerendered page: the markup already shows the loaded carousel,
  // so beginning at false would render the loading prompt the prerendered HTML does not
  // have — a structural mismatch that makes React rebuild the DOM instead of hydrating it.
  const [imageLoaded, setImageLoaded] = useState(IS_PRERENDERED);
  // Tracks whether the very first image has loaded; used to delay the wrapper fade-in
  const [firstImageLoaded, setFirstImageLoaded] = useState(IS_PRERENDERED);
  // Prevents navigating on a drag release that also fires a click event
  const isDraggingRef = useRef(false);
  // Blocks paginate during an active animation so rapid swipes don't queue up
  const animatingRef = useRef(false);

  // useCallback for the same reason: the autoplay effect calls it, so a fresh function
  // each render would reset the timer continuously.
  const paginate = useCallback(
    (dir: number) => {
      if (animatingRef.current) return;
      animatingRef.current = true;
      setImageLoaded(false);
      setSlide(([c]) => [(c + dir + count) % count, dir]);
    },
    [count],
  );

  // Preload adjacent slides so the image is cached before the user swipes to it
  useEffect(() => {
    if (count === 0) return;
    [(current + 1) % count, (current - 1 + count) % count].forEach((i) => {
      const next = CAROUSEL_POEMS[i]?.image;
      if (!next) return;
      const img = new Image();
      // Same srcset and sizes as the rendered slide, so the browser resolves the identical
      // candidate and the warm entry is the one actually requested on swipe. Preloading a
      // fixed w_1600 instead cost a phone two 213KB downloads it would never display, and
      // still missed: the visible <img> asks for w_1280 there.
      img.sizes = '100vw';
      img.srcset = fullBleedSrcSet(next);
      img.src = optimizeUrl(next, FULL_BLEED_W);
    });
  }, [current, count, CAROUSEL_POEMS]);

  // Autoplay: delay proportional to line count so longer poems get more reading time
  useEffect(() => {
    if (isHovered || count === 0) return;
    const poem = CAROUSEL_POEMS[current];
    const lineCount = poem?.overlay ? stripPageBreaks(poem.overlay).split('\n').length : 3;
    const timer = setTimeout(() => paginate(1), Math.max(3000, lineCount * 1000));
    return () => clearTimeout(timer);
  }, [current, isHovered, count, CAROUSEL_POEMS, paginate]);

  const poem = CAROUSEL_POEMS[current];

  return (
    <div
      className={`poem-carousel-wrapper${!loading && count > 0 ? ' carousel-loaded' : ''}${firstImageLoaded ? ' image-ready' : ''}`}
      // Pointer events gated on a real mouse, not onMouseEnter/onMouseLeave. A tap fires
      // compatibility mouse events, so on a touch screen tapping an arrow or swiping set
      // isHovered and never cleared it: the wrapper fills the whole viewport below the
      // header, so there is nowhere to move off to and mouseleave never fires. Autoplay
      // stopped for good. Hover-to-pause is a mouse affordance; touch has no hover.
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setIsHovered(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setIsHovered(false);
      }}
    >
      {/* Cold-cache loading prompt; fades out as the carousel fades in */}
      <AnimatePresence>
        {!firstImageLoaded && (loading || count > 0) && (
          <motion.p
            key="carousel-loading"
            className="loading-prompt carousel-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {t.poems.loading}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="carousel-inner">
        <div className="carousel-section-label">{t.carousel.featured}</div>

        {/* Horizontally sliding carousel; mode="popLayout" lets exit and enter overlap */}
        {/* onDragStart suppresses native HTML5 drag (text/image copy) so Motion gets the pointer cleanly */}
        <div
          style={{ position: 'relative', overflow: 'hidden' }}
          onDragStart={(e) => e.preventDefault()}
        >
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={current}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              onAnimationComplete={() => {
                animatingRef.current = false;
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.1}
              onDragStart={() => {
                isDraggingRef.current = true;
              }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -50) paginate(1);
                else if (info.offset.x > 50) paginate(-1);
                // Delay clearing so the click event that fires after drag-end is still blocked
                setTimeout(() => {
                  isDraggingRef.current = false;
                }, 100);
              }}
              className={`carousel-slide${imageLoaded ? ' image-ready' : ''}`}
            >
              {poem && (
                <>
                  <Link
                    to={`/poems/${poem.id}`}
                    className="carousel-link"
                    onClick={(e) => {
                      if (isDraggingRef.current) e.preventDefault();
                    }}
                  >
                    <div className="carousel-image-container">
                      <img
                        src={optimizeUrl(poem.image, FULL_BLEED_W)}
                        srcSet={fullBleedSrcSet(poem.image)}
                        // The slide spans the viewport, so the browser needs the full width
                        // to choose from srcSet; without this it assumes 100vw anyway but
                        // only after layout, which is later than the preload scanner runs.
                        sizes="100vw"
                        alt={poem.title}
                        draggable={false}
                        onLoad={() => {
                          setImageLoaded(true);
                          setFirstImageLoaded(true);
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {/* Text reveal animations are gated on .image-ready (set by onLoad) */}
                      <div className="carousel-slide-title carousel-overlay-line">{poem.title}</div>
                      {poem.overlay && (
                        <span className="carousel-overlay">
                          <span>
                            {/* Stripped: the carousel shows the poem whole, so a page-break
                                marker would read as a stray line of text. */}
                            {stripPageBreaks(poem.overlay)
                              .split('\n')
                              .map((line, i) => (
                                <span
                                  // Poem lines are positional and never reorder, and two of the poems repeat a
                                  // line, so keying by text would collide.
                                  // biome-ignore lint/suspicious/noArrayIndexKey: positional list, duplicate lines exist
                                  key={i}
                                  className="carousel-overlay-line"
                                  style={{ animationDelay: `${500 + (i + 1) * 100}ms` }}
                                >
                                  {line || ' '}
                                </span>
                              ))}
                          </span>
                        </span>
                      )}
                    </div>
                  </Link>
                  <Link
                    to={`/poems/${poem.id}`}
                    className="carousel-read-more-btn"
                    onClick={(e) => {
                      if (isDraggingRef.current) e.preventDefault();
                    }}
                  >
                    {t.carousel.readMore}
                  </Link>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <PrevArrow onClick={() => paginate(-1)} label={t.carousel.prev} />
        <NextArrow onClick={() => paginate(1)} label={t.carousel.next} />
      </div>
    </div>
  );
}
