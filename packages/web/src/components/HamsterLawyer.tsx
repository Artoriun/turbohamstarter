import { HamsterScene } from './HamsterScene';

/** Gavel raised, about to strike — alternates with GavelDown via the same two-frame
 *  opacity technique HamsterCoding/HamsterWriting use for their own animated details,
 *  rather than a CSS rotation: an SVG group's transform-origin under a CSS transform is
 *  inconsistent enough across browsers that two hand-placed poses is the safer bet. */
function GavelUp() {
  return (
    <g className="lawyer-gavel-a">
      <rect x="25" y="5" width="3" height="2" fill="#0c343d" />
      <rect x="26" y="7" width="1" height="4" fill="#a9784f" />
    </g>
  );
}
function GavelDown() {
  return (
    <g className="lawyer-gavel-b">
      <rect x="24" y="12" width="3" height="2" fill="#0c343d" />
      <rect x="25" y="10" width="1" height="3" fill="#a9784f" />
      <rect x="22" y="13" width="1" height="1" fill="#e88fa0" />
      <rect x="28" y="13" width="1" height="1" fill="#e88fa0" />
    </g>
  );
}

/** TurboHam at the same desk HamsterCoding/HamsterWriting use, restyled as a bench: a
 *  gavel striking a sounding block. Same reasoning as the other two scenes — the mascot
 *  itself is the one static, already-correct pose; only the simple flat-colour props
 *  around it need to read clearly at this size. */
export function HamsterLawyer() {
  return (
    <HamsterScene>
      <rect x="23" y="14" width="4" height="2" fill="#7a5636" />
      <GavelUp />
      <GavelDown />
    </HamsterScene>
  );
}
