import {
  hasPageBreak,
  overlayEdit,
  PAGE_BREAK,
  type Poem,
  splitPages,
  stripPageBreaks,
} from '@gedichtenv2/shared';
import { AnimatePresence, motion } from 'motion/react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import AdminLangToggle from '../components/AdminLangToggle';
import Footer from '../components/Footer';
import Header from '../components/Header';
import { usePoemsContext } from '../context/PoemsContext';
import { useT } from '../i18n';
import {
  apiAddPoem,
  apiLogin,
  apiRefreshToken,
  apiUpdateOrder,
  apiUpdatePoem,
  apiUploadImage,
} from '../lib/api';
import { clearToken, readToken, SESSION_EXPIRED_EVENT, storeToken } from '../lib/token';

const PLACEHOLDER_IMAGE =
  'https://res.cloudinary.com/dgk299isx/image/upload/v1781699336/1000008716_LE_ultra_custom_kcfcsj.png';

// Inject Cloudinary resize/format transforms for grid thumbnails; leaves blob previews
// and non-Cloudinary URLs untouched. Full-res originals are only served in the detail view.
function gridThumb(url: string): string {
  if (!url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_400,dpr_auto/');
}

// Play the one-shot pulse border (border-flow + border-pulse) on a card, matching the
// poems grid highlight. Reflow restarts the animation; class is removed after the pulse.
function playPulse(card: HTMLElement): void {
  card.classList.remove('poem-highlight');
  void card.offsetWidth; // reflow so the animation restarts
  card.classList.add('poem-highlight');
  const rawPulse = getComputedStyle(document.documentElement)
    .getPropertyValue('--pulse-duration')
    .trim();
  const pulseMs = rawPulse.endsWith('ms')
    ? parseFloat(rawPulse)
    : rawPulse.endsWith('s')
      ? parseFloat(rawPulse) * 1000
      : 2400;
  setTimeout(() => card.classList.remove('poem-highlight'), pulseMs);
}
const DRAFT_OVERLAY =
  'Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit,\nsed do eiusmod tempor incididunt,\nut labore et dolore magna aliqua.';

// listVariants orchestrates stagger; cardVariants define each card's enter/exit.
// delayChildren: 0.4 matches body page-load-fade so cards don't animate while body is invisible.
// layout reorder uses transition.layout on each card, not these variants.
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeInOut' as const } },
};

import '../styles/admin.css';

function computeAutoSplit(overlay: string): string[] {
  const lines = overlay.split('\n');
  const headerH =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) ||
    72;
  const landscape = window.innerHeight <= 500;
  const slideH = landscape ? 2 * (window.innerHeight - headerH) : window.innerHeight - headerH;

  // visibility:hidden keeps layout computed; animation:none prevents detail-line-reveal from zeroing opacity
  const overlayEl = document.createElement('div');
  overlayEl.className = 'detail-overlay';
  overlayEl.style.cssText =
    'position:fixed;top:0;left:0;right:0;visibility:hidden;pointer-events:none;';
  lines.forEach((line) => {
    const span = document.createElement('span');
    span.className = 'detail-overlay-line';
    span.textContent = line || '\u00a0';
    span.style.animation = 'none';
    overlayEl.appendChild(span);
  });
  document.body.appendChild(overlayEl);

  const os = getComputedStyle(overlayEl);
  const overlayPadV = parseFloat(os.paddingTop) + parseFloat(os.paddingBottom);
  // Slide 0 always has .has-title: portrait → 140+80=220, landscape → 72+100=172
  const containerPadV = landscape ? 172 : 220;
  const available = slideH - containerPadV - overlayPadV;

  const blankLineH = parseFloat(getComputedStyle(overlayEl).lineHeight);
  const spans = Array.from(overlayEl.querySelectorAll<HTMLElement>('.detail-overlay-line'));
  const pages: string[][] = [[]];
  let accH = 0;
  for (let i = 0; i < spans.length; i++) {
    const isBlank = !lines[i].trim();
    // Use computed lineHeight for blank lines — getBoundingClientRect can return 0 for fit-content empty spans
    const h = isBlank ? blankLineH : spans[i].getBoundingClientRect().height;
    // Only break before non-empty lines — empty lines always belong to the preceding stanza
    if (!isBlank && accH + h > available && pages[pages.length - 1].length > 0) {
      pages.push([]);
      accH = 0;
    }
    pages[pages.length - 1].push(lines[i]);
    accH += h;
  }

  document.body.removeChild(overlayEl);
  return pages
    .map((p) => {
      let e = p.length;
      while (e > 0 && !p[e - 1].trim()) e--;
      return p.slice(0, e);
    })
    .filter((p) => p.length > 0)
    .map((p) => p.join('\n'));
}

type EditState = {
  title: string;
  overlay: string;
  imageFile: File | null;
  imagePreview: string | null;
  customSlides: string[] | null;
  customSlidesOpen: boolean;
  customSlidesEnabled: boolean;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Login ────────────────────────────────────────────────────────────────────

function LoginPage({
  onLogin,
  expired = false,
}: {
  onLogin: (token: string) => void;
  /** Arrived here from a session that ran out, rather than from a plain visit to /admin. */
  expired?: boolean;
}) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await apiLogin(password);
      onLogin(token);
    } catch {
      setError(t.admin.incorrectPassword);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <Header />
      <AdminLangToggle />
      <div className="admin-login-wrap">
        <motion.form
          className="admin-login"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <h1>Admin</h1>
          {expired && <p className="admin-login-notice">{t.admin.sessionExpired}</p>}
          <div>
            <label className="admin-field-label" htmlFor="admin-password">
              {t.admin.password}
            </label>
            <div className="admin-password-wrap">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="admin-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? t.admin.hide : t.admin.show}
              </button>
            </div>
          </div>
          <AnimatePresence>
            {error && (
              <motion.p
                key="error"
                className="admin-login-error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
            {loading ? t.admin.loggingIn : t.admin.logIn}
          </button>
        </motion.form>
      </div>
    </div>
  );
}

// ── Poem edit card ────────────────────────────────────────────────────────────

function PoemCard({
  poem,
  edit,
  onChange,
  onSave,
  onToggleFeature,
  onDelete,
  onCancelCustomSlides,
  status,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  poem: Poem;
  edit: EditState;
  onChange: (patch: Partial<EditState>) => void;
  onSave: () => void;
  onToggleFeature: () => void;
  onDelete: () => void;
  onCancelCustomSlides: () => void;
  status: SaveStatus;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tapRef = useRef<{
    count: number;
    timer: ReturnType<typeof setTimeout> | null;
    pending: boolean;
  }>({ count: 0, timer: null, pending: false });
  const [pendingRemoveIdx, setPendingRemoveIdx] = useState<number | null>(null);
  const [pendingRestoreOriginal, setPendingRestoreOriginal] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  const confirmRemoveSlide = (idx: number) => {
    const next = (edit.customSlides ?? []).filter((_, i) => i !== idx);
    if (next.length === 0) {
      onCancelCustomSlides();
    } else {
      onChange({ customSlides: next });
    }
    setPendingRemoveIdx(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    onChange({ imageFile: file, imagePreview: URL.createObjectURL(file) });
  };

  return (
    <>
      <div
        className={`admin-poem-card${isDragging ? ' dragging' : ''}${poem.featured ? ' poem-highlight-static' : ''}`}
        draggable
        onMouseDown={(e) => {
          const card = e.currentTarget as HTMLElement;
          card.draggable = !(e.target as Element).closest('input, textarea');
        }}
        onTouchStart={(e) => {
          const card = e.currentTarget as HTMLElement;
          card.draggable = !(e.target as Element).closest('input, textarea');
        }}
        onDragStart={(e) => {
          const el = e.currentTarget as HTMLElement;
          const ghost = el.cloneNode(true) as HTMLElement;
          ghost.style.cssText += `;position:fixed;top:-9999px;left:-9999px;width:${el.offsetWidth}px;pointer-events:none;`;
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          requestAnimationFrame(() => document.body.removeChild(ghost));
          onDragStart();
        }}
        onDragEnd={(e) => {
          (e.currentTarget as HTMLElement).draggable = true;
          onDragEnd();
        }}
      >
        {poem.featured && <span className="admin-featured-label">{t.admin.featured}</span>}
        <button
          type="button"
          className="admin-delete-btn"
          onClick={onDelete}
          title={t.admin.deletePoem}
        >
          ×
        </button>
        <div className="admin-poem-image-col">
          <span className="admin-field-label">{t.admin.poemPreview}</span>
          {/* Same overlay preview as the grid cards, so the list shows how the text sits on
              the image. Reads edit.overlay rather than poem.overlay so it tracks the
              textarea live instead of waiting for a save. */}
          <div className="admin-poem-thumb-wrap">
            <img
              src={edit.imagePreview ?? gridThumb(poem.image || PLACEHOLDER_IMAGE)}
              alt={poem.title}
              className="admin-poem-thumb"
              loading="eager"
            />
            {/* Stripped so the preview shows what a visitor sees, not the marker. The
                textarea below keeps it — that is where it is edited. */}
            {edit.overlay && (
              <div className="admin-poem-thumb-overlay">{stripPageBreaks(edit.overlay)}</div>
            )}
          </div>
          <label className="admin-file-label">
            {t.admin.chooseImage}
            <input
              ref={fileInputRef}
              type="file"
              className="admin-file-input"
              accept="image/*"
              onChange={handleFileChange}
            />
          </label>
          {edit.imageFile && <span className="admin-file-name">{edit.imageFile.name}</span>}
        </div>

        <div className="admin-poem-fields">
          <div>
            <span className="admin-field-label">{t.admin.titleLabel}</span>
            <input
              type="text"
              className="admin-title-input"
              value={edit.title}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </div>
          <div>
            <span className="admin-field-label">{t.admin.poemText}</span>
            <textarea
              className="admin-overlay-textarea"
              value={edit.overlay}
              onChange={(e) => onChange(overlayEdit(edit, e.target.value))}
              onTouchStart={() => {
                const s = tapRef.current;
                if (s.timer) clearTimeout(s.timer);
                s.count++;
                if (s.count >= 3) {
                  s.count = 0;
                  s.pending = true;
                } else {
                  s.pending = false;
                  s.timer = setTimeout(() => {
                    s.count = 0;
                  }, 500);
                }
              }}
              onTouchEnd={(e) => {
                const s = tapRef.current;
                if (!s.pending) return;
                s.pending = false;
                e.preventDefault();
                (e.currentTarget as HTMLTextAreaElement).focus();
                // ponytail: deprecated but only API that updates Android's visual selection layer
                document.execCommand('selectAll');
              }}
              onClick={(e) => {
                if ((e.nativeEvent as PointerEvent).pointerType === 'touch') return;
                if (e.detail === 3) {
                  e.preventDefault();
                  e.currentTarget.select();
                }
              }}
            />
            {/* Says the marker out loud, since nothing else in the UI would reveal it. Which
                of the three applies depends on what the marker is currently doing: paging the
                reader, driving the slides below, or nothing at all. */}
            <p className="admin-field-hint">
              {!edit.customSlidesOpen
                ? t.admin.pageBreakHint(PAGE_BREAK)
                : hasPageBreak(edit.overlay || '')
                  ? t.admin.pageBreakHintCustomSlidesLinked(PAGE_BREAK)
                  : t.admin.pageBreakHintCustomSlides}
            </p>
          </div>

          {edit.customSlidesOpen && (
            <div className="admin-custom-slides">
              <span className="admin-field-label">{t.admin.customSlides}</span>
              {(edit.customSlides ?? []).map((slide, idx) => (
                <div
                  // customSlides is a plain string[] with no stable id, so there is nothing
                  // better to key on. Slides can be removed, which is where index keys are
                  // weakest — but the textarea is controlled, so its value follows the data.
                  // Real ids would mean changing the shape stored in Firestore.
                  // biome-ignore lint/suspicious/noArrayIndexKey: string[] has no stable id
                  key={idx}
                  className="admin-slide-row"
                >
                  <span className="admin-slide-num">{idx + 1}</span>
                  <textarea
                    className="admin-overlay-textarea admin-slide-textarea"
                    value={slide}
                    onChange={(e) => {
                      const next = [...(edit.customSlides ?? [])];
                      next[idx] = e.target.value;
                      onChange({ customSlides: next });
                    }}
                  />
                  <button
                    type="button"
                    className="admin-slide-remove-btn"
                    onClick={() => setPendingRemoveIdx(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="admin-slide-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => onChange({ customSlides: [...(edit.customSlides ?? []), ''] })}
                >
                  {t.admin.addSlide}
                </button>
              </div>
            </div>
          )}

          <div className="admin-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => setPendingSave(true)}
              disabled={status === 'saving'}
            >
              {status === 'saving' ? t.admin.saving : t.admin.save}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-custom-slides-active"
              onClick={() => {
                if (edit.customSlidesOpen) {
                  setPendingRestoreOriginal(true);
                } else {
                  // The author's own marks beat a height-based guess: if the poem says where
                  // it breaks, open the slides on exactly those pages. computeAutoSplit is
                  // still the answer for a poem with no marks, which is every poem that has
                  // never been given any.
                  const overlay = edit.overlay || '';
                  const slides = hasPageBreak(overlay)
                    ? splitPages(overlay)
                    : computeAutoSplit(overlay);
                  onChange({
                    customSlidesOpen: true,
                    customSlidesEnabled: true,
                    customSlides: slides,
                  });
                }
              }}
            >
              {edit.customSlidesOpen ? t.admin.original : t.admin.customSlides}
            </button>
            <button
              type="button"
              className={`admin-btn${poem.featured ? ' admin-btn-featured' : ''}`}
              onClick={onToggleFeature}
              disabled={status === 'saving'}
            >
              {poem.featured ? t.admin.unfeature : t.admin.feature}
            </button>
            {status === 'saved' && <span className="admin-save-status">{t.admin.saved}</span>}
            {status === 'error' && (
              <span className="admin-save-status" style={{ color: '#e05a5a' }}>
                {t.admin.errorSaving}
              </span>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {pendingSave && (
          <motion.div
            className="admin-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setPendingSave(false)}
          >
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="admin-modal-title">{t.admin.saveChanges}</p>
              <p className="admin-modal-body">{t.admin.saveChangesBody}</p>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn" onClick={() => setPendingSave(false)}>
                  {t.admin.cancel}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setPendingSave(false);
                    onSave();
                  }}
                >
                  {t.admin.save}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pendingRestoreOriginal && (
          <motion.div
            className="admin-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setPendingRestoreOriginal(false)}
          >
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="admin-modal-title">{t.admin.restoreOriginal}</p>
              <p className="admin-modal-body">{t.admin.restoreOriginalBody}</p>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => setPendingRestoreOriginal(false)}
                >
                  {t.admin.cancel}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => {
                    setPendingRestoreOriginal(false);
                    onCancelCustomSlides();
                  }}
                >
                  {t.admin.restore}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pendingRemoveIdx !== null && (
          <motion.div
            className="admin-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setPendingRemoveIdx(null)}
          >
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="admin-modal-title">{t.admin.deleteSlide}</p>
              <p className="admin-modal-body">{t.admin.deleteSlideBody}</p>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => setPendingRemoveIdx(null)}
                >
                  {t.admin.cancel}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => confirmRemoveSlide(pendingRemoveIdx)}
                >
                  {t.admin.delete}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const t = useT();
  const { poems, loading, refreshPoems } = usePoemsContext();
  const [orderedPoems, setOrderedPoems] = useState<Poem[]>([]);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // State (not ref) so setInitialized + setOrderedPoems batch into one commit,
  // guaranteeing cards mount fresh with initial="hidden" on both login and refresh
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<'list' | 'grid'>(() =>
    localStorage.getItem('admin_mode') === 'grid' ? 'grid' : 'list',
  );
  // Poem id to scroll to in the list after switching from grid via a card click
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  // Set true while a grid card is being dragged so the trailing click doesn't navigate
  const gridDidDrag = useRef(false);
  // Set true when a grid→list poem click pushed a history entry, so popstate returns to grid
  const pushedGridBack = useRef(false);
  // Last poem selected from the grid, so the back button can pulse-highlight it
  const selectedPoemId = useRef<string | null>(null);
  // Poem id to pulse-highlight in the grid after returning via the back button
  const [gridPulseId, setGridPulseId] = useState<string | null>(null);

  const handleSetMode = (m: 'list' | 'grid') => {
    localStorage.setItem('admin_mode', m);
    setMode(m);
  };

  // Clicking a grid card jumps to the List view and scrolls to that poem's edit card.
  // A history entry is pushed so the browser back button returns to the grid.
  const handleGridPoemClick = (id: string) => {
    if (gridDidDrag.current) {
      gridDidDrag.current = false;
      return;
    }
    selectedPoemId.current = id;
    window.history.pushState({ __adminGrid: true }, '');
    pushedGridBack.current = true;
    setScrollTargetId(id);
    handleSetMode('list');
  };

  // Back button after a grid→list poem click returns to the grid instead of leaving /admin,
  // and pulse-highlights the poem that was selected
  useEffect(() => {
    const onPop = () => {
      if (!pushedGridBack.current) return;
      pushedGridBack.current = false;
      localStorage.setItem('admin_mode', 'grid');
      setMode('grid');
      setGridPulseId(selectedPoemId.current);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // After the back button returns to the grid, pulse-highlight the previously selected card
  useEffect(() => {
    if (mode !== 'grid' || !gridPulseId) return;
    const id = gridPulseId;
    const timer = setTimeout(() => {
      setGridPulseId(null);
      const card = document.getElementById(`admin-grid-${id}`);
      if (card) playPulse(card);
    }, 250);
    return () => clearTimeout(timer);
  }, [mode, gridPulseId]);

  // Only three refs needed: timer + ghost + active flag, all for the unmount guard below
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchGhost = useRef<HTMLElement | null>(null);
  const touchActive = useRef(false);

  // Guard: if the component unmounts mid-drag, clean up whatever's in document.body
  useEffect(() => {
    return () => {
      if (touchTimer.current) {
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
      }
      if (touchGhost.current) {
        touchGhost.current.remove();
        touchGhost.current = null;
      }
      touchActive.current = false;
    };
  }, []);

  // After a grid card click switches to List, wait 0.5s for the view to settle,
  // then smooth-scroll to the target card if it's off-screen
  useEffect(() => {
    if (mode !== 'list' || !scrollTargetId) return;
    const id = scrollTargetId;
    const timer = setTimeout(() => {
      setScrollTargetId(null);
      const el = document.getElementById(`admin-poem-${id}`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const headerHeight =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
        ) || 72;
      if (rect.top < headerHeight) {
        window.scrollBy({ top: rect.top - headerHeight - 16, behavior: 'smooth' });
      } else if (rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Play the same one-shot pulse border as the poems grid
      const card = el.querySelector<HTMLElement>('.admin-poem-card');
      if (card) playPulse(card);
    }, 500);
    return () => clearTimeout(timer);
  }, [mode, scrollTargetId]);

  // Initialize once when live poem data loads
  useEffect(() => {
    if (initialized || loading) return;
    setInitialized(true);
    setOrderedPoems(poems);
    setEdits(
      Object.fromEntries(
        poems.map((p) => [
          p.id,
          {
            title: p.title,
            overlay: p.overlay ?? '',
            imageFile: null,
            imagePreview: null,
            customSlides: p.customSlides ?? null,
            customSlidesOpen: !!p.customSlidesEnabled,
            customSlidesEnabled: !!p.customSlidesEnabled,
          },
        ]),
      ),
    );
  }, [poems, loading, initialized]);

  // After refreshPoems: update existing poems and append any newly added ones
  useEffect(() => {
    if (!initialized) return;
    const map = new Map(poems.map((p) => [p.id, p]));
    setOrderedPoems((prev) => {
      const updated = prev.map((p) => map.get(p.id) ?? p);
      const existingIds = new Set(prev.map((p) => p.id));
      const added = poems.filter((p) => !existingIds.has(p.id));
      return [...updated, ...added];
    });
    setEdits((prev) => {
      const next = { ...prev };
      for (const p of poems) {
        if (!next[p.id])
          next[p.id] = {
            title: p.title,
            overlay: p.overlay ?? '',
            imageFile: null,
            imagePreview: null,
            customSlides: p.customSlides ?? null,
            customSlidesOpen: !!p.customSlidesEnabled,
            customSlidesEnabled: !!p.customSlidesEnabled,
          };
      }
      return next;
    });
  }, [poems, initialized]);

  const patchEdit = (id: string, patch: Partial<EditState>) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const setStatus = (id: string, s: SaveStatus) => setStatuses((prev) => ({ ...prev, [id]: s }));

  const handleSave = async (id: string) => {
    const edit = edits[id];
    if (!edit) return;
    setStatus(id, 'saving');
    try {
      let realId = id;
      if (draftIds.has(id)) {
        const created = await apiAddPoem();
        realId = created.id;
        setOrderedPoems((prev) => prev.map((p) => (p.id === id ? { ...p, id: realId } : p)));
        setEdits((prev) => {
          const next = { ...prev, [realId]: prev[id] };
          delete next[id];
          return next;
        });
        setStatuses((prev) => {
          const next = { ...prev, [realId]: 'saving' as SaveStatus };
          delete next[id];
          return next;
        });
        setDraftIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await apiUpdateOrder(orderedPoems.map((p) => (p.id === id ? realId : p.id)));
      }
      let imageUrl: string | undefined;
      if (edit.imageFile) imageUrl = await apiUploadImage(realId, edit.imageFile);
      await apiUpdatePoem(realId, {
        title: edit.title,
        overlay: edit.overlay,
        customSlides: edit.customSlides ?? [],
        customSlidesEnabled: edit.customSlidesOpen,
        ...(imageUrl ? { image: imageUrl } : {}),
      });
      patchEdit(realId, { imageFile: null, imagePreview: imageUrl ?? edit.imagePreview });
      await refreshPoems();
      setStatus(realId, 'saved');
      setTimeout(() => setStatus(realId, 'idle'), 3000);
    } catch {
      setStatus(id, 'error');
      setTimeout(() => setStatus(id, 'idle'), 4000);
    }
  };

  const handleCancelCustomSlides = async (id: string) => {
    patchEdit(id, { customSlidesOpen: false, customSlidesEnabled: false });
    if (!draftIds.has(id)) {
      try {
        await apiUpdatePoem(id, { customSlidesEnabled: false });
        await refreshPoems();
      } catch {
        /* silent */
      }
    }
  };

  const handleAddPoem = () => {
    const tempId = `poem-draft-${Date.now()}`;
    const newPoem: Poem = {
      id: tempId,
      title: t.admin.newPoemTitle,
      overlay: DRAFT_OVERLAY,
      image: PLACEHOLDER_IMAGE,
    };
    setOrderedPoems((prev) => [newPoem, ...prev]);
    setEdits((prev) => ({
      ...prev,
      [tempId]: {
        title: t.admin.newPoemTitle,
        overlay: DRAFT_OVERLAY,
        imageFile: null,
        imagePreview: null,
        customSlides: null,
        customSlidesOpen: false,
        customSlidesEnabled: false,
      },
    }));
    setDraftIds((prev) => new Set([...prev, tempId]));
  };

  const handleDelete = async (id: string) => {
    setOrderedPoems((prev) => prev.filter((p) => p.id !== id));
    if (draftIds.has(id)) {
      setDraftIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    try {
      await apiUpdatePoem(id, { deleted: true });
      await refreshPoems();
    } catch {
      await refreshPoems();
    }
  };

  const handleToggleFeature = async (id: string) => {
    const poem = orderedPoems.find((p) => p.id === id);
    if (!poem) return;
    const featured = !poem.featured;
    setOrderedPoems((prev) => prev.map((p) => (p.id === id ? { ...p, featured } : p)));
    if (draftIds.has(id)) return;
    try {
      await apiUpdatePoem(id, { featured });
    } catch {
      setOrderedPoems((prev) => prev.map((p) => (p.id === id ? { ...p, featured: !featured } : p)));
    }
  };

  // Grid drops swap the two cards; list drops lift the card out and reinsert it, shifting
  // everything in between. Dropping onto a specific tile reads as "put these two in each
  // other's place", where dragging down a list reads as "move this one to here".
  const handleDrop = async (toIndex: number, swap = false) => {
    if (dragIndex === null || dragIndex === toIndex) return;
    const next = [...orderedPoems];
    if (swap) {
      [next[dragIndex], next[toIndex]] = [next[toIndex], next[dragIndex]];
    } else {
      const [moved] = next.splice(dragIndex, 1);
      next.splice(toIndex, 0, moved);
    }
    setOrderedPoems(next);
    setDragIndex(null);
    setDropIndex(null);
    try {
      await apiUpdateOrder(next.map((p) => p.id));
      refreshPoems();
    } catch {
      setOrderedPoems(orderedPoems); // revert on error
    }
  };

  return (
    <div className="admin-page">
      <Header onLogout={onLogout} />
      <AdminLangToggle />

      <AnimatePresence mode="wait">
        {!initialized ? (
          <motion.p
            key="loading"
            className="loading-prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.3 }}
          >
            {t.admin.loadingPoems}
          </motion.p>
        ) : (
          <motion.div
            key="list"
            className="admin-poem-list"
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div className="admin-top-row" variants={cardVariants}>
              <div className="admin-mode-toggle">
                <button
                  type="button"
                  className={`admin-mode-btn${mode === 'list' ? ' active' : ''}`}
                  onClick={() => handleSetMode('list')}
                >
                  {t.admin.list}
                </button>
                <button
                  type="button"
                  className={`admin-mode-btn${mode === 'grid' ? ' active' : ''}`}
                  onClick={() => handleSetMode('grid')}
                >
                  {t.admin.order}
                </button>
              </div>
              {mode === 'list' && (
                <div className="admin-add-row">
                  {/* The visible label is the sibling span, so without this the button
                      announces itself as "+" and nothing else. */}
                  <button
                    type="button"
                    className="admin-add-btn"
                    onClick={handleAddPoem}
                    aria-label={t.admin.addPoem}
                  >
                    +
                  </button>
                  <span className="admin-add-label">{t.admin.addPoem}</span>
                </div>
              )}
            </motion.div>
            {mode === 'list' ? (
              orderedPoems.map((poem, i) => (
                // Outer: stagger + fade via variants. Inner: FLIP reorder via layout.
                // Combining layout and variants on the same element causes Motion to apply
                // the y transform from hidden but skip opacity — split avoids the conflict.
                <motion.div key={poem.id} id={`admin-poem-${poem.id}`} variants={cardVariants}>
                  <motion.div
                    layout
                    transition={{ layout: { duration: 0.35, ease: 'easeInOut' } }}
                    className={`admin-card-wrapper${dropIndex === i && dragIndex !== null && dragIndex !== i ? ' drop-target' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropIndex(i);
                    }}
                    onDrop={() => handleDrop(i)}
                  >
                    <PoemCard
                      poem={poem}
                      edit={
                        edits[poem.id] ?? {
                          title: poem.title,
                          overlay: poem.overlay ?? '',
                          imageFile: null,
                          imagePreview: null,
                          customSlides: poem.customSlides ?? null,
                          customSlidesOpen: !!poem.customSlidesEnabled,
                          customSlidesEnabled: !!poem.customSlidesEnabled,
                        }
                      }
                      onChange={(patch) => patchEdit(poem.id, patch)}
                      onSave={() => handleSave(poem.id)}
                      onToggleFeature={() => handleToggleFeature(poem.id)}
                      onDelete={() => setPendingDeleteId(poem.id)}
                      onCancelCustomSlides={() => handleCancelCustomSlides(poem.id)}
                      status={statuses[poem.id] ?? 'idle'}
                      onDragStart={() => setDragIndex(i)}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDropIndex(null);
                      }}
                      isDragging={dragIndex === i}
                    />
                  </motion.div>
                </motion.div>
              ))
            ) : (
              <div className="admin-grid-view">
                {orderedPoems.map((poem, i) => (
                  <div
                    key={poem.id}
                    data-gi={i}
                    style={{ '--gi': i } as React.CSSProperties}
                    className={`admin-grid-item${dragIndex === i ? ' is-dragging' : ''}${dropIndex === i && dragIndex !== null && dragIndex !== i ? ' drop-target' : ''}`}
                    draggable
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() => handleGridPoemClick(poem.id)}
                    onMouseDown={() => {
                      gridDidDrag.current = false;
                    }}
                    onTouchStart={(e) => {
                      gridDidDrag.current = false;
                      if (touchGhost.current) {
                        touchGhost.current.remove();
                        touchGhost.current = null;
                      }
                      if (touchTimer.current) {
                        clearTimeout(touchTimer.current);
                        touchTimer.current = null;
                      }
                      touchActive.current = false;

                      const el = e.currentTarget as HTMLElement;
                      const t = e.touches[0];
                      const startX = t.clientX;
                      const startY = t.clientY;
                      const rect = el.getBoundingClientRect();
                      const offsetX = t.clientX - rect.left;
                      const offsetY = t.clientY - rect.top;
                      let dst = i;

                      const handleMove = (me: TouchEvent) => {
                        const mt = me.touches[0];
                        if (!touchActive.current) {
                          if (
                            Math.abs(mt.clientX - startX) > 10 ||
                            Math.abs(mt.clientY - startY) > 10
                          ) {
                            clearTimeout(touchTimer.current!);
                            touchTimer.current = null;
                            el.removeEventListener('touchmove', handleMove);
                            el.removeEventListener('touchend', handleEnd);
                            el.removeEventListener('touchcancel', handleEnd);
                          }
                          return;
                        }
                        me.preventDefault();
                        if (touchGhost.current) {
                          touchGhost.current.style.visibility = 'hidden';
                          const under = document
                            .elementFromPoint(mt.clientX, mt.clientY)
                            ?.closest<HTMLElement>('[data-gi]');
                          touchGhost.current.style.visibility = '';
                          touchGhost.current.style.left = `${mt.clientX - offsetX}px`;
                          touchGhost.current.style.top = `${mt.clientY - offsetY}px`;
                          if (under) {
                            const idx = parseInt(under.dataset.gi ?? '', 10);
                            if (!Number.isNaN(idx)) {
                              dst = idx;
                              setDropIndex(idx);
                            }
                          }
                        }
                      };

                      const handleEnd = () => {
                        if (touchTimer.current) {
                          clearTimeout(touchTimer.current);
                          touchTimer.current = null;
                        }
                        if (touchGhost.current) {
                          touchGhost.current.remove();
                          touchGhost.current = null;
                        }
                        el.removeEventListener('touchmove', handleMove);
                        el.removeEventListener('touchend', handleEnd);
                        el.removeEventListener('touchcancel', handleEnd);
                        touchActive.current = false;
                        setDragIndex(null);
                        setDropIndex(null);
                        if (i !== dst) {
                          setOrderedPoems((prev) => {
                            const next = [...prev];
                            // Swap, matching the mouse path's handleDrop(i, true). Touch
                            // drag is a separate code path, so it has to be kept in step.
                            [next[i], next[dst]] = [next[dst], next[i]];
                            apiUpdateOrder(next.map((p) => p.id))
                              .then(() => refreshPoems())
                              .catch(() => {});
                            return next;
                          });
                        }
                      };

                      el.addEventListener('touchmove', handleMove, { passive: false });
                      el.addEventListener('touchend', handleEnd);
                      el.addEventListener('touchcancel', handleEnd);

                      touchTimer.current = setTimeout(() => {
                        if (!el.isConnected) return;
                        touchActive.current = true;
                        gridDidDrag.current = true;
                        setDragIndex(i);
                        const r = el.getBoundingClientRect();
                        const ghost = el.cloneNode(true) as HTMLElement;
                        ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;width:${r.width}px;left:${r.left}px;top:${r.top}px;opacity:0.9;transform:scale(1.05);border-radius:4px;box-shadow:0 8px 24px rgba(0,0,0,0.35);`;
                        document.body.appendChild(ghost);
                        touchGhost.current = ghost;
                      }, 300);
                    }}
                    onDragStart={(e) => {
                      gridDidDrag.current = true;
                      const el = e.currentTarget as HTMLElement;
                      const ghost = el.cloneNode(true) as HTMLElement;
                      ghost.style.cssText += `;position:fixed;top:-9999px;left:-9999px;width:${el.offsetWidth}px;pointer-events:none;`;
                      document.body.appendChild(ghost);
                      e.dataTransfer.setDragImage(
                        ghost,
                        e.nativeEvent.offsetX,
                        e.nativeEvent.offsetY,
                      );
                      requestAnimationFrame(() => document.body.removeChild(ghost));
                      e.dataTransfer.effectAllowed = 'move';
                      setDragIndex(i);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDropIndex(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropIndex(i);
                    }}
                    onDrop={() => handleDrop(i, true)}
                  >
                    <p className="admin-grid-card-title">{edits[poem.id]?.title ?? poem.title}</p>
                    <div
                      id={`admin-grid-${poem.id}`}
                      className={`admin-grid-card${poem.featured ? ' poem-highlight-static' : ''}`}
                    >
                      {/* Live feature toggle badge, absolutely positioned over the image so
                        it never shifts the layout — images stay aligned whether featured or not.
                        stopPropagation + draggable=false keep taps from starting a card drag. */}
                      <button
                        type="button"
                        className="admin-grid-featured-label"
                        draggable={false}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFeature(poem.id);
                        }}
                        title={poem.featured ? t.admin.unfeaturePoem : t.admin.featurePoem}
                      >
                        <span className="admin-grid-unfeature-x">{poem.featured ? '×' : '✓'}</span>
                        <span>{poem.featured ? t.admin.featured : t.admin.featurePrompt}</span>
                      </button>
                      <div className="admin-grid-card-img-wrap">
                        <img
                          src={
                            edits[poem.id]?.imagePreview ??
                            gridThumb(poem.image ?? PLACEHOLDER_IMAGE)
                          }
                          alt={poem.title}
                          loading="eager"
                        />
                      </div>
                      {poem.overlay && (
                        <div className="admin-grid-card-overlay">{poem.overlay}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AnimatePresence lets the modal animate out before unmounting */}
      <AnimatePresence>
        {pendingDeleteId && (
          <motion.div
            className="admin-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setPendingDeleteId(null)}
          >
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="admin-modal-title">{t.admin.deletePoem}</p>
              <p className="admin-modal-body">{t.admin.deletePoemBody}</p>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => setPendingDeleteId(null)}
                >
                  {t.admin.cancel}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => {
                    handleDelete(pendingDeleteId);
                    setPendingDeleteId(null);
                  }}
                >
                  {t.admin.delete}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer />
    </div>
  );
}

// ── Admin entry point ─────────────────────────────────────────────────────────

/**
 * How often the open portal considers renewing its token. Well under the three days of
 * headroom `apiRefreshToken` waits for, so a tab left open overnight is still covered, and
 * the call is a no-op on all but the last few days of a session.
 */
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export default function Admin() {
  const [token, setToken] = useState<string | null>(readToken);
  const [expired, setExpired] = useState(false);
  const { refreshPoems } = usePoemsContext();

  useEffect(() => {
    return () => {
      refreshPoems();
    };
  }, [refreshPoems]);

  // A 401, or a token that ran out while this tab sat open. Both used to reload the page
  // out from under whatever was being edited; now the login form comes back with a reason.
  useEffect(() => {
    const onExpired = () => {
      setToken(null);
      setExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    if (!token) return;
    void apiRefreshToken();
    const id = setInterval(() => void apiRefreshToken(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token]);

  const handleLogin = (t: string) => {
    storeToken(t);
    setExpired(false);
    setToken(t);
  };

  const handleLogout = () => {
    clearToken();
    setExpired(false);
    setToken(null);
  };

  if (!token) return <LoginPage onLogin={handleLogin} expired={expired} />;
  return <Dashboard onLogout={handleLogout} />;
}
