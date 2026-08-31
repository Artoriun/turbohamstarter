/**
 * TurboHam, the mascot. Sixteen poses in a sprite sheet, sequenced by CSS into four idles:
 * a sway, a nose twitch with the eyes shut, a dash off-screen, and a nap he wakes from
 * with a start.
 *
 * The poses are real pixel variations in src/assets/hamster-sprite.svg, not a CSS
 * transform of one drawing. That is what gives him the stepped, retro feel: nothing
 * tweens, the pixels themselves change. The timing lives in global.css.
 *
 * Rendered as an empty element with the sheet as a background rather than inline SVG,
 * because a sprite sheet is driven by background-position and this project prerenders by
 * capturing innerHTML — an inline style here would be re-serialised by the browser and
 * disagree with React on hydration. All of it lives in CSS, which the capture leaves alone.
 */
export function TurboHam({ className = '' }: { className?: string }) {
  return <span className={`mascot ${className}`.trim()} aria-hidden="true" />;
}
