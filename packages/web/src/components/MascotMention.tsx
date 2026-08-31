import { splitOnMascot } from '@hamstarter/shared';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useT } from '../i18n';
import { TurboHam } from './TurboHam';

/**
 * Splits text on the mascot's name and interleaves a pressable mention. The matching rule,
 * and why the product name is not caught by it, lives in splitOnMascot.
 *
 * Each run of text is returned as a single string, never as adjacent literals with markup
 * between them: this project prerenders by capturing innerHTML, and a stray extra text node
 * makes the client's first render disagree with the captured markup. The prerenderer's
 * hydration gate catches that, but it is cheaper not to write it.
 */
export function withMascot(text: string): ReactNode {
  const parts = splitOnMascot(text);
  if (parts.length === 1) return text;

  return parts.flatMap((part, i) =>
    // biome-ignore lint/suspicious/noArrayIndexKey: positional split of one immutable string
    i === 0 ? [part] : [<MascotMention key={`m${i}`} />, part],
  );
}

export function MascotMention() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popId = useId();

  // Dismissal, both ways a disclosure is expected to close. Not a modal: focus stays on the
  // button, nothing behind it is inert, and there is nothing inside to tab to — so a focus
  // trap would be wrong here, not merely unnecessary.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <span className="mascot-mention" ref={wrapRef}>
      <button
        type="button"
        className="mascot-mention-btn"
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((v) => !v)}
      >
        TurboHam
      </button>
      {open && (
        <span className="mascot-pop" id={popId} role="status">
          <TurboHam className="mascot-pop-sprite" />
          <span className="mascot-pop-label">{t.home.mascotHint}</span>
        </span>
      )}
    </span>
  );
}
