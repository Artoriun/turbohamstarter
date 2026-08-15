import { HamsterScene } from './HamsterScene';

/** The letter gains a second line, and the pen moves to sit at the end of whichever line is
 *  "current" — alternated by the CSS animation driving visibility (see .writing-a/-b in
 *  global.css), the same cheap two-frame technique HamsterCoding uses for its screen. */
function WritingA() {
  return (
    <g className="writing-a">
      <rect x="18" y="11" width="6" height="1" fill="#8e979c" />
      <rect x="23" y="10" width="1" height="2" fill="#0c343d" />
    </g>
  );
}
function WritingB() {
  return (
    <g className="writing-b">
      <rect x="18" y="11" width="6" height="1" fill="#8e979c" />
      <rect x="18" y="13" width="8" height="1" fill="#8e979c" />
      <rect x="25" y="12" width="1" height="2" fill="#0c343d" />
    </g>
  );
}

/** TurboHam at the same desk as HamsterCoding, a sheet of paper standing in for the
 *  monitor. Deliberately the same composition (desk, same hamster placement) as the coding
 *  scene — one consistent "TurboHam at his desk" set piece the two illustrations share,
 *  rather than two unrelated ones. */
export function HamsterWriting() {
  return (
    <HamsterScene>
      <rect x="16" y="9" width="13" height="8" fill="#fbf1de" />
      <WritingA />
      <WritingB />
    </HamsterScene>
  );
}
