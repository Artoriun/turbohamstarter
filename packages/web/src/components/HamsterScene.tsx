import type { ReactNode } from 'react';

/**
 * The wrapper, mascot placement and desk shared by HamsterCoding, HamsterWriting and
 * HamsterLawyer — one consistent "TurboHam at his desk" set piece the three illustrations
 * are variations on, factored out rather than repeated three times over.
 *
 * The mascot itself is `.hamster-scene-mascot`, a real element carrying the exact same
 * background-image + `hamster-idle` animation as the header's `.mascot` (see global.css) —
 * not pixel data re-drawn as SVG rects. That's what makes its animation the literal same
 * one the header plays rather than a separately hand-built approximation of it. It sits
 * outside the props SVG (absolutely positioned over it, see global.css) because a sprite-
 * sheet background-image has no equivalent inside SVG markup the way it does on an HTML
 * element.
 */
export function HamsterScene({ children }: { children: ReactNode }) {
  return (
    <div className="hamster-scene" aria-hidden="true">
      <span className="hamster-scene-mascot" />
      <svg
        viewBox="0 0 32 20"
        className="hamster-scene-props"
        aria-hidden="true"
        shapeRendering="crispEdges"
      >
        {children}
        <rect x="0" y="16" width="32" height="2" fill="#a9784f" />
        <rect x="0" y="18" width="32" height="2" fill="#7a5636" />
      </svg>
    </div>
  );
}
