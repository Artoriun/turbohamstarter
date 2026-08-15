import { HamsterScene } from './HamsterScene';

/**
 * Two "screenfuls" of code, alternated by the CSS animation driving this component's
 * visibility (see .coding-screen-a/-b in global.css) — cheap motion that reads as typing
 * without animating the mascot's own pose, which only exists as a single static frame
 * (see HamsterPixels).
 */
function ScreenLinesA() {
  return (
    <g className="coding-screen-a">
      <rect x="20" y="7" width="6" height="1" fill="#42b2ae" />
      <rect x="20" y="9" width="4" height="1" fill="#8e979c" />
      <rect x="21" y="11" width="7" height="1" fill="#e88fa0" />
      <rect x="20" y="13" width="3" height="1" fill="#8e979c" />
    </g>
  );
}
function ScreenLinesB() {
  return (
    <g className="coding-screen-b">
      <rect x="20" y="7" width="8" height="1" fill="#42b2ae" />
      <rect x="20" y="9" width="6" height="1" fill="#e8934a" />
      <rect x="21" y="11" width="4" height="1" fill="#8e979c" />
      <rect x="20" y="13" width="6" height="1" fill="#8e979c" />
      <rect x="21" y="14" width="3" height="1" fill="#e88fa0" />
    </g>
  );
}

/** TurboHam at a desk, a code editor's worth of coloured bars standing in for text on the
 *  monitor. Desk and monitor are plain flat-colour rects, deliberately simple geometry —
 *  only the mascot itself needs to carry real pixel-art detail for this to read as "him". */
export function HamsterCoding() {
  return (
    <HamsterScene>
      <rect x="18" y="5" width="12" height="10" fill="#0c343d" />
      <rect x="19" y="6" width="10" height="8" fill="#04231d" />
      <rect x="23" y="15" width="2" height="1" fill="#0c343d" />
      <ScreenLinesA />
      <ScreenLinesB />
    </HamsterScene>
  );
}
