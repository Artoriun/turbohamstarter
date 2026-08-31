import { type CarouselSlide, type Lang, localise } from '@hamstarter/shared';
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { useLang, useT } from '../i18n';
import { optimizeUrl } from '../lib/images';
import { DEFAULT_PROJECT_IMAGES } from '../lib/projectAssets';
import { HamsterPixels } from './HamsterPixels';

// Long enough to clear the prerenderer's content-stability check, which watches the page
// for 3.5s after load and fails the build if the visible text changes in that window — see
// the "content stability" gate in scripts/prerender.mjs. Short enough that a visitor who
// stays on the page actually sees more than one slide.
const AUTOPLAY_MS = 6000;
// Must match the CSS transition duration on .carousel-track — this is how long the silent
// post-wrap reset (see the effect below) waits before it's safe to assume the slide
// animation has actually finished.
const TRANSITION_MS = 420;
// Pixels a drag must travel to commit to the next/prev slide, rather than snap back. A
// flat pixel value rather than a fraction of the frame width: a real swipe travels roughly
// the same physical distance on a phone or a wide desktop pointer drag alike.
const DRAG_THRESHOLD = 50;
// Pixels of movement, more horizontal than vertical, before a pointer press counts as a
// drag rather than a tap or a vertical page scroll.
//
// Higher for touch than for a mouse, and that difference is the whole point: a finger tap
// routinely slides several pixels while a mouse click does not move at all. At the mouse
// threshold those taps were classed as drags, and a drag deliberately suppresses the click
// that follows it — so tapping a project card on a phone opened nothing, with no way to
// tell the difference from an unresponsive page.
const DRAG_INTENT_MOUSE = 8;
const DRAG_INTENT_TOUCH = 16;
// Must match .carousel-slide's width/gap in global.css — the two need to agree for a live
// drag's translateX to line up with where the track actually settles.
const ITEM_WIDTH = 380;
const ITEM_GAP = 20;
const STEP = ITEM_WIDTH + ITEM_GAP;

function reducedMotionPreferred() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function slideImageSrc(slide: CarouselSlide) {
  return slide.image || DEFAULT_PROJECT_IMAGES[slide.id] || '';
}

/** Caps how far a fast/long drag can visually pull the track, so a long swipe still reads
 *  as "dragging the row" rather than detaching from the pointer entirely. */
function damp(dx: number, viewportWidth: number) {
  const limit = viewportWidth * 0.6;
  if (Math.abs(dx) <= limit) return dx;
  const excess = Math.abs(dx) - limit;
  return Math.sign(dx) * (limit + excess * 0.35);
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}
function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 5v14M16 5v14" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 5l12 7-12 7Z" />
    </svg>
  );
}

type SlideLinkProps = {
  slide: CarouselSlide;
  lang: Lang;
  viewProjectLabel: string;
  priority?: boolean;
  onImageRef?: (img: HTMLImageElement | null) => void;
} & Omit<ComponentPropsWithoutRef<typeof Link>, 'to' | 'children'>;

/** One slide's markup — image + overlay caption — as a `<Link>` to its project page. The
 *  track renders every slide three times over (see ProjectCarousel); only the one at the
 *  current track position is focusable and announced, the rest are aria-hidden decorative
 *  copies clickable by mouse alone, backed by the prev/next buttons as the equivalent
 *  keyboard/AT path for the same outcome. */
const SlideLink = forwardRef<HTMLAnchorElement, SlideLinkProps>(function SlideLink(
  { slide, lang, viewProjectLabel, priority, onImageRef, className, ...rest },
  ref,
) {
  const { heading } = localise(slide, lang);
  const isDefaultImage = !slide.image;
  return (
    <Link
      ref={ref}
      to={`/projects/${slide.id}`}
      className={`carousel-slide${className ? ` ${className}` : ''}`}
      draggable={false}
      {...rest}
    >
      <img
        ref={onImageRef}
        className={isDefaultImage ? 'pixel-img' : undefined}
        src={optimizeUrl(slideImageSrc(slide), 900)}
        alt=""
        loading="eager"
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        draggable={false}
      />
      <span className="carousel-overlay">
        <span className="carousel-overlay-title">{heading}</span>
        <span className="carousel-overlay-cta">{viewProjectLabel}</span>
      </span>
    </Link>
  );
});

/**
 * Auto-cycling, drag-swipeable, multi-item carousel of a `kind: 'carousel'` section's
 * slides. The section itself decides which page this renders on and where in the flow —
 * see Home.tsx/About.tsx — this component only ever renders the slides it's handed.
 *
 * A row of fixed-width cards (.carousel-track) slides via a single CSS `transform:
 * translateX(...)`, animated by a CSS transition rather than per-slide keyframes — that's
 * what makes several cards move together smoothly instead of one popping in as the next
 * takes over. Motion-free regardless (no `motion` library): a carousel can be the very
 * first thing rendered on a landing page, and Motion writes its animated values as inline
 * styles that a prerendered page's hydration can disagree with (see PageTransition.tsx).
 * The transform this writes is plain CSS driven by React state, computed identically on
 * the render hydration compares against and on the client's first render alike, so it
 * carries none of that risk.
 *
 * The slide array is rendered three times back to back (`extended`) so that navigating
 * past either end can keep sliding in the same direction into a copy that looks pixel-
 * identical to the real target, rather than jumping backwards through the whole row or
 * cutting the animation short. Once that slide's transition has actually finished, an
 * effect below silently — transition disabled for one frame — snaps the track index back
 * into the middle copy at the equivalent position. Both positions render identically, so
 * nothing visibly moves.
 */
export function ProjectCarousel({ slides }: { slides: CarouselSlide[] }) {
  const { lang } = useLang();
  const t = useT();
  const count = slides.length;
  const extended = count > 0 ? [...slides, ...slides, ...slides] : [];

  // Index into `extended`. Starts at the head of the middle copy; count > 0 is guaranteed
  // by the time this matters (see the count === 0 return below), but the initial value has
  // to be computed unconditionally since hooks can't follow that check.
  const [trackIndex, setTrackIndex] = useState(count);
  const [paused, setPaused] = useState(false);
  const [dragPx, setDragPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // False only for the single frame the post-wrap reset below needs the jump to be
  // invisible, and for the duration of a live drag (direct manipulation, not an animated
  // transition).
  const [animate, setAnimate] = useState(true);
  // Starts false — never true on the render hydration compares against, since the
  // prerender capture only ever runs once the image has already loaded. Flipped by the
  // effect below, which checks the real DOM state after mount; see the comment there.
  const [showLoading, setShowLoading] = useState(false);

  const mainImgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const index = count > 0 ? ((trackIndex % count) + count) % count : 0;

  // A slide deleted from the admin portal while this was open must not leave trackIndex
  // pointing past the end of a now-shorter extended[].
  useEffect(() => {
    if (count > 0 && trackIndex >= count * 3) setTrackIndex(count);
  }, [count, trackIndex]);

  // The silent post-wrap reset described in the component doc comment above.
  useEffect(() => {
    if (count === 0 || (trackIndex >= count && trackIndex < count * 2)) return;
    const timer = setTimeout(() => {
      setAnimate(false);
      setTrackIndex((i) => (i >= count * 2 ? i - count : i + count));
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    }, TRANSITION_MS + 30);
    return () => clearTimeout(timer);
  }, [trackIndex, count]);

  function next() {
    if (count < 2) return;
    setTrackIndex((i) => i + 1);
  }
  function prev() {
    if (count < 2) return;
    setTrackIndex((i) => i - 1);
  }
  function goTo(targetIndex: number) {
    setTrackIndex(count + targetIndex);
  }

  // trackIndex is deliberately a dependency despite not being read in the body: every
  // slide change — whether from this timer or a manual prev/next/dot/drag/arrow-key change
  // — should restart the countdown, not race an old one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    if (paused || isDragging || count < 2) return;
    // Vestibular disorders aside, a slideshow that keeps moving after someone has said they
    // would rather it did not is the same mistake `MotionConfig reducedMotion="user"` exists
    // to avoid elsewhere in this app — that one only reaches Motion's animations, not a
    // plain setTimeout, so it is repeated here.
    if (reducedMotionPreferred()) return;
    const timer = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [trackIndex, paused, isDragging, count]);

  // The resting slide's own image is eager + high-priority already, which covers the
  // common case; this only ever matters on a slow connection or a cold Cloudinary
  // transform. Runs after mount rather than deciding up front, so the render hydration
  // compares against — which never shows this — always matches: a real visitor's browser
  // often starts fetching an <img> from parsed HTML before React hydrates at all, so
  // `.complete` here reflects what actually happened, not a guess made before the fetch
  // had a chance to start.
  // trackIndex is deliberately a dependency despite not being read in the body: it is what
  // determines which <img> mainImgRef now points at after the remount a changed `key` on
  // that SlideLink causes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    const img = mainImgRef.current;
    if (!img) return;
    if (img.complete) {
      setShowLoading(false);
      return;
    }
    setShowLoading(true);
    const onDone = () => setShowLoading(false);
    img.addEventListener('load', onDone);
    // A broken image should stop blocking the view, not spin forever.
    img.addEventListener('error', onDone);
    return () => {
      img.removeEventListener('load', onDone);
      img.removeEventListener('error', onDone);
    };
  }, [trackIndex]);

  function handleSlideClick(e: ReactMouseEvent) {
    if (isDraggingRef.current) e.preventDefault();
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (count < 2) return;
    if ((e.target as HTMLElement).closest('.carousel-nav-btn, .carousel-pause-btn')) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start || count < 2) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!isDraggingRef.current) {
      const intent = e.pointerType === 'mouse' ? DRAG_INTENT_MOUSE : DRAG_INTENT_TOUCH;
      if (Math.abs(dx) < intent || Math.abs(dx) < Math.abs(dy)) return;
      isDraggingRef.current = true;
      setIsDragging(true);
      setAnimate(false);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    setDragPx(damp(dx, frameRef.current?.offsetWidth || 1));
  }

  function onPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!isDraggingRef.current || !start) return;
    // Cleared shortly after release, not immediately: a pointerup that ends a drag still
    // fires a synthetic click on the underlying <Link> a moment later, and
    // handleSlideClick reads this ref to swallow that specific click without touching
    // ordinary taps.
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);

    const dx = e.clientX - start.x;
    setIsDragging(false);
    setAnimate(true);
    setDragPx(0);
    if (Math.abs(dx) > DRAG_THRESHOLD) {
      setTrackIndex((i) => i + (dx < 0 ? 1 : -1));
    }
  }

  if (count === 0) return null;

  return (
    // Focus, not just hover, pauses it — a keyboard or touch user has no hover state, and
    // WCAG 2.2.2 wants a way to stop auto-advancing content regardless of input device. The
    // explicit pause button below covers touch; this covers keyboard users tabbing through.
    <div
      className="project-carousel"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onKeyDown={(e) => {
        if (count < 2) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          next();
        }
      }}
    >
      <p className="eyebrow">{t.carousel.label}</p>
      <div
        ref={frameRef}
        className={`carousel-frame${isDragging ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div
          className="carousel-track"
          style={{
            transform: `translateX(calc(-1 * ${trackIndex} * ${STEP}px + ${dragPx}px))`,
            transition: animate ? undefined : 'none',
          }}
        >
          {extended.map((s, i) => (
            <SlideLink
              // extended is 3 fixed, never-reordered copies of slides — the index is as
              // stable an identity here as s.id alone, which repeats 3x and can't be the
              // key by itself.
              // biome-ignore lint/suspicious/noArrayIndexKey: see comment above
              key={`${s.id}-${i}`}
              slide={s}
              lang={lang}
              viewProjectLabel={t.carousel.viewProject}
              priority={i === trackIndex}
              onImageRef={i === trackIndex ? (img) => (mainImgRef.current = img) : undefined}
              onClick={handleSlideClick}
              // `undefined`, not `false`, for the active slide — React writes
              // `aria-hidden="false"` for a literal false, and that's still a match for
              // the `:not([aria-hidden])` selector e2e/carousel.spec.ts relies on to find
              // exactly one slide.
              aria-hidden={i === trackIndex ? undefined : true}
              tabIndex={i === trackIndex ? undefined : -1}
            />
          ))}
        </div>
        {showLoading && (
          <div className="carousel-loading" role="status" aria-live="polite">
            <div className="carousel-loading-wheel">
              {/* The wheel and the mascot are one SVG, not a spinning SVG plus a
                  background-image TurboHam layered on top — a background-image is a
                  second network request that can still be loading when the whole point of
                  this element is to stand in for something else that is slow to load,
                  and once inserted after mount (see the effect above) some browsers do
                  not reliably repaint it when that second request finally does land. */}
              <svg viewBox="0 0 64 64" className="loading-wheel-svg" aria-hidden="true">
                <circle cx="32" cy="32" r="27" />
                <line x1="32" y1="5" x2="32" y2="59" />
                <line x1="5" y1="32" x2="59" y2="32" />
                <line x1="13" y1="13" x2="51" y2="51" />
                <line x1="51" y1="13" x2="13" y2="51" />
                <g
                  transform="translate(32, 32) scale(1.8) translate(-7, -7)"
                  shapeRendering="crispEdges"
                >
                  <HamsterPixels />
                </g>
              </svg>
            </div>
            <p className="carousel-loading-text">{t.carousel.loading}</p>
          </div>
        )}
        {count > 1 && (
          <>
            <button
              type="button"
              className="carousel-nav-btn carousel-nav-prev"
              onClick={prev}
              aria-label={t.carousel.prev}
              title={t.carousel.prev}
            >
              <PrevIcon />
            </button>
            <button
              type="button"
              className="carousel-nav-btn carousel-nav-next"
              onClick={next}
              aria-label={t.carousel.next}
              title={t.carousel.next}
            >
              <NextIcon />
            </button>
            <button
              type="button"
              className="carousel-pause-btn"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? t.carousel.play : t.carousel.pause}
              title={paused ? t.carousel.play : t.carousel.pause}
              aria-pressed={paused}
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="carousel-dots">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`carousel-dot${i === index ? ' is-active' : ''}`}
              aria-label={`${t.carousel.goTo} ${i + 1}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
