import { AnimatePresence, m, type Variants } from 'motion/react';
import { type ReactNode, useEffect, useRef } from 'react';

/**
 * Route transitions, and the staggered entrance of whatever the route renders.
 *
 * The whole Motion tree stays out of the page a visitor lands on — see the note in the
 * component below — so there is no `initial={false}` here. It was there originally and was
 * wrong: it suppresses the enter animation for the first child AnimatePresence sees, and
 * because this tree only ever mounts on the first navigation, that first child *is* the
 * incoming page. The page therefore appeared at its final state and only its staggered
 * children animated afterwards, which reads as the content arriving and then animating.
 */

const DURATION = 0.32;
// Tuple, not number[]: Motion's Easing type wants a fixed-length cubic-bezier.
const EASE = [0.22, 1, 0.36, 1] as const;

const page: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION, ease: EASE, staggerChildren: 0.06 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' } },
};

/** Applied to direct children of a page so they arrive in sequence rather than at once. */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } },
};

/**
 * Whether the visitor has navigated yet. Module scope, so it survives the remount that
 * the first navigation causes.
 */
let hasNavigated = false;

export function PageTransition({
  children,
  /**
   * The pathname the `children` were rendered for. Passed in rather than read from the
   * router here: AnimatePresence keeps the outgoing element mounted through its exit, and
   * if this component resolved the location itself, that outgoing copy would re-render
   * against the *new* one. The exiting page then shows the incoming page's content,
   * fading it out before fading it back in — the content arrives, then animates.
   * The caller pins <Routes location={…}> to the same value, so the pair cannot drift.
   */
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const landedOn = useRef(pathname);

  if (pathname !== landedOn.current) hasNavigated = true;
  const animated = hasNavigated;

  // A client-side navigation leaves the browser's own scroll position exactly where it
  // was — unlike a full page load, nothing about switching React Router's location
  // touches it, so a visitor who scrolled down before clicking a link lands on the new
  // page partway down it. Direct property writes rather than `window.scrollTo`, since
  // `html { scroll-behavior: smooth }` would otherwise turn this into a visible scroll
  // animation instead of an instant reset. Runs on every pathname change including the
  // very first — harmless there since the browser already starts a fresh load at 0.
  //
  // AnimatePresence's own `onExitComplete` looked like the more "correct" place for this
  // — reset once the outgoing page has actually left, not the instant the click happens —
  // but it never fires for this tree (verified against both dev and a production build),
  // so this runs as soon as the pathname changes instead. In practice that reads fine: it
  // lands before the exit fade even starts, so the transition just plays out at the top
  // rather than wherever the visitor had scrolled to.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs only when the route itself changes, not on every render
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  /**
   * The page a visitor lands on renders with no Motion element at all.
   *
   * Motion writes its animated values as an inline style, and this project prerenders by
   * capturing innerHTML from a real DOM — where the browser has already re-serialised that
   * attribute as `opacity: 1; transform: none;`. React writes the same declaration as
   * `opacity:1;transform:none`, so hydration compares the two, disagrees, and throws the
   * markup away. Nothing looks broken afterwards, because React simply re-renders — but the
   * Largest Contentful Paint candidate goes with it.
   *
   * Keeping the first paint free of Motion sidesteps that completely. From the first
   * navigation onwards there is no prerendered markup to preserve, and everything animates
   * normally.
   *
   * The landing page is not left static, though — `.page-landing` in global.css gives it a
   * staggered rise in plain CSS. That version deliberately animates transform only, since
   * the prerendered content is already painted and fading it back in would surrender the
   * head start; see the note there.
   */
  if (!animated)
    return (
      <div className="page-landing" style={{ width: '100%' }}>
        {children}
      </div>
    );

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={pathname}
        variants={page}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{ width: '100%' }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

/**
 * A single element in the stagger. Renders as a plain div until the visitor navigates, for
 * the same reason as above — on the landing page it must not contribute an inline style
 * that hydration will disagree about.
 */
export function Item({ children, className }: { children: ReactNode; className?: string }) {
  if (!hasNavigated) return <div className={className}>{children}</div>;
  return (
    <m.div variants={itemVariants} className={className}>
      {children}
    </m.div>
  );
}
