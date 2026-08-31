import {
  type CarouselSlide,
  DEFAULT_LANG,
  findProfanity,
  LANGS,
  type Section,
  type Settings,
} from '@hamstarter/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useContent } from '../context/ContentContext';
import { LanguageProvider, useT } from '../i18n';
import {
  apiCreateSection,
  apiGetSettings,
  apiLogin,
  apiRefreshToken,
  apiUpdateSection,
  apiUpdateSettings,
  apiUploadImage,
  clearToken,
  getToken,
  SESSION_EXPIRED_EVENT,
  setToken,
  TooManyAttemptsError,
} from '../lib/api';
import { optimizeUrl } from '../lib/images';

/**
 * m:ss for a countdown. The thirty-second lockout would read fine as plain seconds, but the
 * fifteen-minute limit behind it would not — "try again in 873s" is a number nobody converts.
 */
const countdown = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Set to true to expose the profanity filter's controls in the portal.
 *
 * Hidden by default and deliberately a code change rather than a setting: the filter is on
 * out of the box, and the person it protects is usually not the person who should be able
 * to switch it off from the browser. Whoever wants it off is already editing this
 * repository. The rule itself is enforced by the API either way — hiding the control does
 * not disable anything.
 */
const SHOW_PROFANITY_SETTING = false;

/** The categories the filter bar offers. 'footer' is chrome, not a category — it stays
 *  pinned and visible under every filter instead of getting its own tab. */
const FILTERABLE_PAGES: Array<Exclude<Section['page'], 'footer'>> = ['home', 'about'];
type Filter = 'all' | (typeof FILTERABLE_PAGES)[number];

/**
 * The whole admin portal: sign in, edit content, reorder, upload an image.
 *
 * Lazy-loaded from App.tsx so none of this ships in the bundle a visitor downloads, and
 * excluded from the prerender so the portal is never part of the static HTML.
 *
 * Wrapped in its own scoped LanguageProvider, pinned to DEFAULT_LANG: whoever is editing
 * content might have arrived via /admin or /ja/admin depending on whatever page they were
 * last looking at, and the portal's own UI (Save, Sections, the field labels) should read
 * the same either way rather than depending on that accident of navigation. Scoped so the
 * language toggle in the shared Header — still rendered above this, still reading the
 * site-wide provider — keeps working normally and doesn't navigate the admin session away.
 */
export default function Admin() {
  return (
    <LanguageProvider scoped defaultLang={DEFAULT_LANG}>
      <AdminGate />
    </LanguageProvider>
  );
}

/**
 * How often the open portal considers renewing its token. Well under the three days of
 * headroom `apiRefreshToken` waits for, so a tab left open overnight is still covered, and
 * the call is a no-op on all but the last few days of a session.
 */
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function AdminGate() {
  const t = useT();
  const { sections, refresh } = useContent();
  const [signedIn, setSignedIn] = useState(() => !!getToken());
  const [expired, setExpired] = useState(false);

  // A 401, or a token that ran out while this tab sat open. Either way the sign-in form comes
  // back with a reason, rather than the next action simply failing.
  useEffect(() => {
    const onExpired = () => {
      setSignedIn(false);
      setExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void apiRefreshToken();
    const id = setInterval(() => void apiRefreshToken(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [signedIn]);

  if (!signedIn)
    return (
      <SignIn
        notice={expired ? t.admin.sessionExpired : ''}
        onSuccess={() => {
          setExpired(false);
          setSignedIn(true);
        }}
      />
    );

  return (
    <AdminPanel
      sections={sections}
      refresh={refresh}
      onSignOut={() => {
        clearToken();
        setSignedIn(false);
      }}
      t={t}
    />
  );
}

function SignIn({ notice, onSuccess }: { notice?: string; onSuccess: () => void }) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(notice ?? '');
  const [busy, setBusy] = useState(false);
  /** Seconds left on the three-strikes lockout; 0 when the form is usable. */
  const [lockedFor, setLockedFor] = useState(0);

  // A timeout that reschedules itself rather than an interval. Over thirty seconds the drift
  // is invisible, and this needs no separate path for the moment it reaches zero.
  useEffect(() => {
    if (!lockedFor) return;
    const id = setTimeout(() => setLockedFor(lockedFor - 1), 1000);
    return () => clearTimeout(id);
  }, [lockedFor]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setToken(await apiLogin(password));
      onSuccess();
    } catch (err) {
      if (err instanceof TooManyAttemptsError) {
        // The one exception to the rule below: a lockout shown as "incorrect password" is a
        // support call from someone typing a password they know is right. The person seeing
        // this is the one who caused it, so it tells an attacker nothing new.
        setLockedFor(err.retryAfter ?? 0);
        if (!err.retryAfter) setError(t.admin.tooManyAttempts);
      } else {
        // Deliberately one message for both a wrong password and an unreachable API: the
        // distinction is useful to an attacker enumerating whether the portal is live.
        setError(t.admin.wrongPassword);
      }
    } finally {
      setBusy(false);
      setPassword('');
    }
  }

  const lockMessage = lockedFor ? t.admin.lockedOut.replace('{time}', countdown(lockedFor)) : '';

  return (
    <div className="page prose admin-signin">
      <h1>{t.admin.title}</h1>
      <form onSubmit={submit} className="contact-form">
        <label htmlFor="password">{t.admin.password}</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={lockedFor > 0}
        />
        {(lockMessage || error) && (
          <p className="form-error" role="alert">
            {lockMessage || error}
          </p>
        )}
        <button type="submit" className="btn btn-sm btn-primary" disabled={busy || lockedFor > 0}>
          {t.admin.signIn}
        </button>
      </form>
    </div>
  );
}

/** One slide's fields within a carousel card — same shape as a section's own heading/body/
 *  translations/image editor, one level deeper. Mutations flow back through the callbacks
 *  rather than an id lookup, since a slide only exists inside its section's `slides` array. */
function SlideEditor({
  slide,
  t,
  offendingWords,
  onEdit,
  onRemove,
  onUploadImage,
}: {
  slide: CarouselSlide;
  t: ReturnType<typeof useT>;
  offendingWords: string[];
  onEdit: (patch: Partial<CarouselSlide>) => void;
  onRemove: () => void;
  onUploadImage: (file: File) => void;
}) {
  return (
    <li className="admin-slide">
      <label htmlFor={`slide-heading-${slide.id}`}>{t.admin.heading}</label>
      <input
        id={`slide-heading-${slide.id}`}
        value={slide.heading}
        onChange={(e) => onEdit({ heading: e.target.value })}
      />

      <label htmlFor={`slide-body-${slide.id}`}>{t.admin.body}</label>
      <textarea
        id={`slide-body-${slide.id}`}
        rows={3}
        value={slide.body}
        onChange={(e) => onEdit({ body: e.target.value })}
      />

      {LANGS.filter((l) => l !== DEFAULT_LANG).map((code) => (
        <div key={code} className="admin-translation">
          <span className="admin-translation-label">{code.toUpperCase()}</span>
          <input
            aria-label={`${t.admin.heading} (${code})`}
            placeholder={slide.heading}
            value={slide.translations?.[code]?.heading ?? ''}
            onChange={(e) =>
              onEdit({
                translations: {
                  ...slide.translations,
                  [code]: { ...slide.translations?.[code], heading: e.target.value },
                },
              })
            }
          />
          <textarea
            aria-label={`${t.admin.body} (${code})`}
            rows={2}
            placeholder={slide.body}
            value={slide.translations?.[code]?.body ?? ''}
            onChange={(e) =>
              onEdit({
                translations: {
                  ...slide.translations,
                  [code]: { ...slide.translations?.[code], body: e.target.value },
                },
              })
            }
          />
        </div>
      ))}

      <label htmlFor={`slide-image-${slide.id}`}>{t.admin.image}</label>
      <input
        id={`slide-image-${slide.id}`}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadImage(file);
        }}
      />
      {slide.image && (
        <img className="admin-thumb" src={optimizeUrl(slide.image, 240)} alt="" width={120} />
      )}

      {offendingWords.length > 0 && (
        <p className="admin-warning" role="status">
          {t.admin.blockedWarning} {offendingWords.join(', ')}
        </p>
      )}

      <button type="button" className="btn btn-sm btn-danger" onClick={onRemove}>
        {t.admin.deleteSlide}
      </button>
    </li>
  );
}

function AdminPanel({
  sections,
  refresh,
  onSignOut,
  t,
}: {
  sections: Section[];
  refresh: () => Promise<void>;
  onSignOut: () => void;
  t: ReturnType<typeof useT>;
}) {
  const [items, setItems] = useState<Section[]>(sections);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    apiGetSettings()
      .then(setSettings)
      // Unreachable settings must not lock the portal: the API enforces the rule anyway,
      // so the worst case is losing the as-you-type warning.
      .catch(() => setSettings({ profanityFilter: false }));
  }, []);

  /** Live check, so the writer sees it before pressing save rather than after. */
  const offending = (section: Section): string[] => {
    if (!settings?.profanityFilter) return [];
    return [
      ...new Set(
        [section.heading, section.body].flatMap((t) =>
          findProfanity(t, settings.blocklist).map((m) => m.word),
        ),
      ),
    ];
  };

  /** Same check, for one slide of a carousel section — its heading/body are what actually
   *  renders on the site, unlike the carousel section's own (see Section.slides). */
  const offendingSlide = (slide: CarouselSlide): string[] => {
    if (!settings?.profanityFilter) return [];
    return [
      ...new Set(
        [slide.heading, slide.body].flatMap((t) =>
          findProfanity(t, settings.blocklist).map((m) => m.word),
        ),
      ),
    ];
  };

  async function toggleFilter(on: boolean) {
    const next: Settings = { ...(settings ?? {}), profanityFilter: on };
    setSettings(next);
    try {
      setSettings(await apiUpdateSettings(next));
    } catch {
      setStatus('error');
    }
  }

  // The context refreshes independently; mirror it into local state so edits stay
  // responsive without a round trip per keystroke.
  useEffect(() => setItems(sections), [sections]);

  const edit = (id: string, patch: Partial<Section>) =>
    setItems((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  async function save(section: Section) {
    setStatus('saving');
    setBlocked([]);
    try {
      await apiUpdateSection(section.id, {
        page: section.page,
        kind: section.kind,
        heading: section.heading,
        body: section.body,
        image: section.image,
        translations: section.translations,
        slides: section.slides,
      });
      await refresh();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch (err) {
      const words = (err as Error & { words?: string[] }).words;
      if (words) {
        setBlocked(words);
        setStatus('idle');
        return;
      }
      setStatus('error');
    }
  }

  async function add() {
    try {
      // Lands in whichever category is currently filtered to, so it shows up immediately
      // rather than appearing under Home while you're looking at About. 'all' has no
      // single category to land in, so it falls back to the same default as before.
      await apiCreateSection(filter === 'all' ? 'home' : filter);
      await refresh();
    } catch {
      setStatus('error');
    }
  }

  async function addCarousel() {
    try {
      await apiCreateSection(filter === 'all' ? 'home' : filter, 'carousel');
      await refresh();
    } catch {
      setStatus('error');
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t.admin.confirmDelete)) return;
    try {
      // Soft delete: the section stops rendering but the record survives, so a mistake is
      // recoverable. DELETE /api/content/:id removes it outright if you want that.
      await apiUpdateSection(id, { deleted: true });
      await refresh();
    } catch {
      setStatus('error');
    }
  }

  /**
   * The footer is site chrome rather than page content: it is pinned to the bottom of the
   * list, has no move controls, and cannot be reordered into the middle of the pages. It is
   * modelled as a page so it reuses the same editing and translation machinery, but that is
   * an implementation detail and the portal should not present it as somewhere to put a
   * section.
   */
  const isChrome = (s: Section) => s.page === 'footer';
  // Sorted the same way the public site sorts (see sectionsForPage/usePageSections): by
  // `order` ascending, chrome pinned last regardless of its own order value. The admin list
  // and the rendered page have to agree on this, or a section can sit at the top here and
  // the bottom there — which is exactly what showed up before this sort existed, for a
  // carousel section bundled with a negative `order` to put it ahead of the hero.
  const ordered = [...items].sort((a, b) => {
    const chrome = Number(isChrome(a)) - Number(isChrome(b));
    return chrome !== 0 ? chrome : (a.order ?? 0) - (b.order ?? 0);
  });
  const movable = ordered.filter((s) => !isChrome(s));
  // What the filter bar is currently showing — move() reorders within this, not the full
  // cross-category list, so the arrows swap with the neighbour actually on screen rather
  // than with whatever the next item happens to be in an unrelated category.
  const categorized = filter === 'all' ? movable : movable.filter((s) => s.page === filter);
  const displayed = [...categorized, ...ordered.filter(isChrome)];

  /**
   * Swaps the `order` field between two adjacent-in-this-filter sections and persists both
   * — not their array position. `order` is what the public site actually sorts by
   * (sectionsForPage), so this is the only form of "move" that has any effect there; an
   * earlier version reordered an id list the site never read, which moved a card in the
   * admin list without ever moving anything a visitor could see.
   */
  async function move(id: string, delta: number) {
    const from = categorized.findIndex((s) => s.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= categorized.length) return;
    const a = categorized[from];
    const b = categorized[to];
    const [aOrder, bOrder] = [b.order ?? 0, a.order ?? 0];
    edit(a.id, { order: aOrder });
    edit(b.id, { order: bOrder });
    try {
      await Promise.all([
        apiUpdateSection(a.id, { order: aOrder }),
        apiUpdateSection(b.id, { order: bOrder }),
      ]);
      await refresh();
    } catch {
      setStatus('error');
    }
  }

  async function upload(section: Section, file: File) {
    setStatus('saving');
    try {
      const url = await apiUploadImage(section.id, file);
      edit(section.id, { image: url });
      await apiUpdateSection(section.id, { image: url });
      await refresh();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  // Slides live only inside their carousel section's own `slides` array — there is no
  // separate slide entity server-side — so adding, editing and removing one is just an
  // array patch through the same `edit()` used for heading/body, applied to that one field.
  // Nothing round-trips to the API until the card's own Save button is pressed, same as any
  // other field; only the image upload below persists immediately, matching `upload()`.
  function editSlide(section: Section, slideId: string, patch: Partial<CarouselSlide>) {
    edit(section.id, {
      slides: (section.slides ?? []).map((s) => (s.id === slideId ? { ...s, ...patch } : s)),
    });
  }

  function addSlide(section: Section) {
    const newSlide: CarouselSlide = {
      id: `slide-${Date.now()}`,
      heading: 'New slide',
      body: 'Write something here.',
    };
    edit(section.id, { slides: [...(section.slides ?? []), newSlide] });
  }

  function removeSlide(section: Section, slideId: string) {
    if (!window.confirm(t.admin.confirmDeleteSlide)) return;
    edit(section.id, { slides: (section.slides ?? []).filter((s) => s.id !== slideId) });
  }

  async function uploadSlideImage(section: Section, slideId: string, file: File) {
    setStatus('saving');
    try {
      const url = await apiUploadImage(`${section.id}-${slideId}`, file);
      const slides = (section.slides ?? []).map((s) =>
        s.id === slideId ? { ...s, image: url } : s,
      );
      edit(section.id, { slides });
      await apiUpdateSection(section.id, { slides });
      await refresh();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="page admin">
      <div className="admin-head">
        <h1>{t.admin.title}</h1>
        <div className="admin-head-actions">
          <span className="admin-status" role="status">
            {status === 'saving' && t.admin.saving}
            {status === 'saved' && t.admin.saved}
            {status === 'error' && t.admin.saveFailed}
          </span>
          <button type="button" className="btn btn-sm" onClick={onSignOut}>
            {t.admin.signOut}
          </button>
        </div>
      </div>

      {SHOW_PROFANITY_SETTING && (
        <section className="admin-settings">
          <div className="admin-settings-row">
            <label htmlFor="profanity-filter">
              <strong>{t.admin.filterTitle}</strong>
            </label>
            <input
              id="profanity-filter"
              type="checkbox"
              checked={!!settings?.profanityFilter}
              disabled={!settings}
              onChange={(e) => toggleFilter(e.target.checked)}
            />
            <span className="admin-settings-state">
              {settings?.profanityFilter ? t.admin.filterOn : t.admin.filterOff}
            </span>
          </div>
          <p className="admin-hint">{t.admin.filterHint}</p>

          {settings?.profanityFilter && (
            <>
              <label htmlFor="blocklist">{t.admin.blocklist}</label>
              <input
                id="blocklist"
                value={(settings.blocklist ?? []).join(', ')}
                placeholder={t.admin.blocklistHint}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    blocklist: e.target.value.split(',').map((w) => w.trim()),
                  })
                }
                onBlur={() =>
                  apiUpdateSettings({
                    ...settings,
                    blocklist: (settings.blocklist ?? []).filter(Boolean),
                  })
                    .then(setSettings)
                    .catch(() => setStatus('error'))
                }
              />
              <p className="admin-hint">{t.admin.blocklistHint}</p>
            </>
          )}
        </section>
      )}

      {blocked.length > 0 && (
        <p className="form-error" role="alert">
          {t.admin.blockedSave} {blocked.join(', ')}
        </p>
      )}

      <div className="admin-filters">
        <button
          type="button"
          className={`btn btn-sm${filter === 'all' ? ' btn-primary' : ''}`}
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          {t.admin.filterAll}
        </button>
        {FILTERABLE_PAGES.map((page) => (
          <button
            key={page}
            type="button"
            className={`btn btn-sm${filter === page ? ' btn-primary' : ''}`}
            aria-pressed={filter === page}
            onClick={() => setFilter(page)}
          >
            {page}
          </button>
        ))}
      </div>

      <div className="admin-toolbar">
        <h2>{t.admin.sections}</h2>
        <div className="admin-toolbar-actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={add}>
            {t.admin.addSection}
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={addCarousel}>
            {t.admin.addCarousel}
          </button>
        </div>
      </div>

      <ul className="admin-list">
        {displayed.map((section) => (
          <li key={section.id} className="admin-card">
            <div className="admin-card-row">
              <span className="admin-card-fixed">
                {t.admin.page}: {section.page}
              </span>

              {!isChrome(section) && (
                <div className="admin-card-move">
                  <button
                    type="button"
                    className="btn btn-sm btn-icon"
                    aria-label={t.admin.moveUp}
                    disabled={categorized[0]?.id === section.id}
                    onClick={() => move(section.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-icon"
                    aria-label={t.admin.moveDown}
                    disabled={categorized[categorized.length - 1]?.id === section.id}
                    onClick={() => move(section.id, 1)}
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>

            {section.kind === 'carousel' ? (
              <>
                <label htmlFor={`heading-${section.id}`}>{t.admin.heading}</label>
                <input
                  id={`heading-${section.id}`}
                  value={section.heading}
                  onChange={(e) => edit(section.id, { heading: e.target.value })}
                />

                <div className="admin-slides-toolbar">
                  <span className="admin-card-fixed">{t.admin.slides}</span>
                  <button type="button" className="btn btn-sm" onClick={() => addSlide(section)}>
                    {t.admin.addSlide}
                  </button>
                </div>
                <ul className="admin-slides">
                  {(section.slides ?? []).map((slide) => (
                    <SlideEditor
                      key={slide.id}
                      slide={slide}
                      t={t}
                      offendingWords={offendingSlide(slide)}
                      onEdit={(patch) => editSlide(section, slide.id, patch)}
                      onRemove={() => removeSlide(section, slide.id)}
                      onUploadImage={(file) => uploadSlideImage(section, slide.id, file)}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <>
                <label htmlFor={`heading-${section.id}`}>{t.admin.heading}</label>
                <input
                  id={`heading-${section.id}`}
                  value={section.heading}
                  onChange={(e) => edit(section.id, { heading: e.target.value })}
                />

                <label htmlFor={`body-${section.id}`}>{t.admin.body}</label>
                <textarea
                  id={`body-${section.id}`}
                  rows={4}
                  value={section.body}
                  onChange={(e) => edit(section.id, { body: e.target.value })}
                />

                {/* One pair per additional language. The default language uses the fields
                    above; anything left empty here falls back to them, so a half-translated
                    site shows the default rather than a gap. */}
                {LANGS.filter((l) => l !== DEFAULT_LANG).map((code) => (
                  <div key={code} className="admin-translation">
                    <span className="admin-translation-label">{code.toUpperCase()}</span>
                    <input
                      aria-label={`${t.admin.heading} (${code})`}
                      placeholder={section.heading}
                      value={section.translations?.[code]?.heading ?? ''}
                      onChange={(e) =>
                        edit(section.id, {
                          translations: {
                            ...section.translations,
                            [code]: { ...section.translations?.[code], heading: e.target.value },
                          },
                        })
                      }
                    />
                    <textarea
                      aria-label={`${t.admin.body} (${code})`}
                      rows={3}
                      placeholder={section.body}
                      value={section.translations?.[code]?.body ?? ''}
                      onChange={(e) =>
                        edit(section.id, {
                          translations: {
                            ...section.translations,
                            [code]: { ...section.translations?.[code], body: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                ))}

                <label htmlFor={`image-${section.id}`}>{t.admin.image}</label>
                <input
                  id={`image-${section.id}`}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(section, file);
                  }}
                />
                {section.image && (
                  <img
                    className="admin-thumb"
                    src={optimizeUrl(section.image, 240)}
                    alt=""
                    width={120}
                  />
                )}

                {offending(section).length > 0 && (
                  <p className="admin-warning" role="status">
                    {t.admin.blockedWarning} {offending(section).join(', ')}
                  </p>
                )}
              </>
            )}

            <div className="admin-card-actions">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => save(section)}
              >
                {t.admin.save}
              </button>
              {/* The footer is not one of the filterable categories, so a deleted one could
                  not be recreated from the portal (add() only ever targets FILTERABLE_PAGES).
                  It is editable, not removable. */}
              {!isChrome(section) && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => remove(section.id)}
                >
                  {t.admin.delete}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
