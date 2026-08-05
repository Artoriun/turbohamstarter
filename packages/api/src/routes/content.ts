import { findProfanity, SECTIONS, type Section } from '@hamstarter/shared';
import { v2 as cloudinary } from 'cloudinary';
import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../asyncHandler';
import { db } from '../firebaseAdmin';
import { requireAuth } from '../middleware/requireAuth';
import { loadSettings } from './settings';

/**
 * Editable content, served as the bundled defaults with Firestore overrides merged on top.
 *
 * The merge is the important part. `SECTIONS` in the shared package is what the site
 * renders before the API answers and what it keeps rendering if the API is asleep — free
 * tiers sleep — so the site is never blank. Firestore only ever holds the *difference*
 * from those defaults, which also keeps writes small.
 */
export const contentRouter = Router();

const COLLECTION = 'sections';

// Memory storage, not disk: Render's filesystem is ephemeral and the buffer goes straight
// to Cloudinary. 10MB is well above any sensible web image and well below the point where
// a handful of concurrent uploads would exhaust a free instance's memory.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

type Override = Partial<Omit<Section, 'id'>>;

/**
 * Public. Never fails: a Firestore outage falls back to the bundled content with a 200,
 * because a visitor should see the site rather than an error. That does mean this endpoint
 * cannot be used to detect a broken data layer — /health/deps exists for that.
 */
contentRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    try {
      const snap = await db.collection(COLLECTION).get();

      const overrides: Record<string, Override> = {};
      snap.forEach((doc) => {
        overrides[doc.id] = doc.data() as Override;
      });

      const bundledIds = new Set(SECTIONS.map((s) => s.id));
      const merged: Section[] = SECTIONS.map((s) =>
        overrides[s.id] ? ({ ...s, ...overrides[s.id] } as Section) : s,
      );
      // Sections created in the admin portal have no bundled counterpart.
      const created: Section[] = Object.entries(overrides)
        .filter(([id]) => !bundledIds.has(id))
        .map(([id, d]) => ({
          id,
          page: d.page ?? 'home',
          heading: d.heading ?? 'Untitled',
          body: d.body ?? '',
          image: d.image,
          order: d.order,
          deleted: d.deleted,
          kind: d.kind,
          slides: d.slides,
        }));

      // Array order here is not display order: both the client (usePageSections) and the
      // prerenderer (sectionsForPage) always re-sort each page's sections by their own
      // `order` field, so there is nothing to gain — and a real risk of the two silently
      // disagreeing — from trying to also order this response.
      res.json([...merged, ...created].filter((s) => !s.deleted));
    } catch {
      res.json(SECTIONS.filter((s) => !s.deleted));
    }
  }),
);

contentRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page, kind } = req.body as { page?: Section['page']; kind?: Section['kind'] };
    const id = `section-${Date.now()}`;
    const data: Override = {
      page: page ?? 'home',
      heading: kind === 'carousel' ? 'New carousel' : 'New section',
      body: kind === 'carousel' ? '' : 'Write something here.',
      order: Date.now(),
      // Firestore rejects an explicit `undefined`, so this is only present at all for a
      // carousel — a plain section simply has no `kind`/`slides` fields written.
      ...(kind === 'carousel' ? { kind: 'carousel' as const, slides: [] } : {}),
    };
    await db.collection(COLLECTION).doc(id).set(data);
    res.json({ id, ...data });
  }),
);

/**
 * The filter is enforced here, not only in the portal.
 *
 * The browser check exists so the writer finds out while typing; this one exists because
 * it is the only place the rule actually holds. Anything with a token and curl skips the
 * UI entirely, and a check that can be skipped is a suggestion.
 */
async function profanityRefusal(
  fields: Array<string | undefined>,
): Promise<{ words: string[] } | null> {
  const settings = await loadSettings();
  if (!settings.profanityFilter) return null;
  const words = new Set<string>();
  for (const value of fields) {
    if (typeof value !== 'string') continue;
    for (const m of findProfanity(value, settings.blocklist)) words.add(m.word);
  }
  return words.size ? { words: [...words] } : null;
}

contentRouter.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body as Override;

    // Translations are checked too: a filter that only reads the default language is a
    // filter with a hole in it. A carousel's own heading/body are never rendered — see the
    // note on Section.slides — but each slide's are, so those are checked in its place.
    const translated = Object.values(body.translations ?? {}).flatMap((v) => [v?.heading, v?.body]);
    const slideFields = (body.slides ?? []).flatMap((slide) => [
      slide.heading,
      slide.body,
      ...Object.values(slide.translations ?? {}).flatMap((v) => [v?.heading, v?.body]),
    ]);
    const refused = await profanityRefusal([
      body.heading,
      body.body,
      ...translated,
      ...slideFields,
    ]);
    if (refused) {
      res.status(422).json({
        error: 'Blocked by the profanity filter.',
        words: refused.words,
      });
      return;
    }
    // Allow-list rather than passing req.body through: an unknown key would be written to
    // Firestore verbatim and served to every visitor.
    const data: Override = {};
    if (body.page !== undefined) data.page = body.page;
    if (body.kind !== undefined) data.kind = body.kind;
    if (body.heading !== undefined) data.heading = body.heading;
    if (body.body !== undefined) data.body = body.body;
    if (body.image !== undefined) data.image = body.image;
    if (body.order !== undefined) data.order = body.order;
    if (body.deleted !== undefined) data.deleted = body.deleted;
    if (body.translations !== undefined) data.translations = body.translations;
    if (body.slides !== undefined) data.slides = body.slides;

    // merge, so editing one field cannot blank the others.
    await db.collection(COLLECTION).doc(req.params.id).set(data, { merge: true });
    res.json({ ok: true });
  }),
);

/**
 * Hard delete. The portal soft-deletes by default (`deleted: true`) so a section can be
 * restored; this removes the override entirely, which for a bundled section means it
 * reverts to the text in packages/shared.
 */
contentRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  }),
);

contentRouter.post(
  '/:id/image',
  requireAuth,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!process.env.CLOUDINARY_URL) {
      res.status(503).json({ error: 'Image upload is not configured. Set CLOUDINARY_URL.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    try {
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { folder: 'sections', public_id: `${req.params.id}-${Date.now()}` },
            (error, uploaded) =>
              error ? reject(error) : resolve(uploaded as { secure_url: string }),
          )
          .end(req.file?.buffer);
      });
      res.json({ url: result.secure_url });
    } catch (err) {
      console.error('[content] image upload failed:', err);
      res.status(500).json({ error: 'Image upload failed' });
    }
  }),
);
