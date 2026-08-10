import { POEMS } from '@gedichtenv2/shared';
import { v2 as cloudinary } from 'cloudinary';
import { Router } from 'express';
import multer from 'multer';
import { db } from '../firebaseAdmin';
import { requireAuth } from '../middleware/requireAuth';

export const poemsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

poemsRouter.get('/', async (_req, res) => {
  try {
    const [poemsSnap, orderDoc] = await Promise.all([
      db.collection('poems').get(),
      db.collection('config').doc('poemOrder').get(),
    ]);
    const overrides: Record<
      string,
      {
        title?: string;
        image?: string;
        overlay?: string;
        featured?: boolean;
        deleted?: boolean;
        customSlides?: string[];
        customSlidesEnabled?: boolean;
      }
    > = {};
    poemsSnap.forEach((doc) => {
      overrides[doc.id] = doc.data() as (typeof overrides)[string];
    });

    const hardcodedIds = new Set(POEMS.map((p) => p.id));
    const merged = POEMS.map((p) => (overrides[p.id] ? { ...p, ...overrides[p.id] } : p)).filter(
      (p) => !p.deleted,
    );
    const custom = Object.entries(overrides)
      .filter(([id, d]) => !hardcodedIds.has(id) && !d.deleted)
      .map(([id, d]) => ({
        id,
        title: d.title ?? 'New Poem',
        image:
          d.image ||
          'https://res.cloudinary.com/dgk299isx/image/upload/v1781699336/1000008716_LE_ultra_custom_kcfcsj.png',
        overlay: d.overlay,
        featured: d.featured,
        customSlides: d.customSlides,
        customSlidesEnabled: d.customSlidesEnabled,
      }));
    const all = [...merged, ...custom];

    if (orderDoc.exists) {
      const ids = orderDoc.data()?.ids as string[];
      const map = new Map(all.map((p) => [p.id, p]));
      const sorted = ids.map((id) => map.get(id)).filter(Boolean) as typeof all;
      const inOrder = new Set(ids);
      res.json([...sorted, ...all.filter((p) => !inOrder.has(p.id))]);
    } else {
      res.json(all);
    }
  } catch {
    res.json(POEMS);
  }
});

poemsRouter.post('/', requireAuth, async (_req, res) => {
  const id = `poem-custom-${Date.now()}`;
  const data = {
    title: 'New Poem',
    overlay:
      'Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit,\nsed do eiusmod tempor incididunt,\nut labore et dolore magna aliqua.',
    image:
      'https://res.cloudinary.com/dgk299isx/image/upload/v1781699336/1000008716_LE_ultra_custom_kcfcsj.png',
  };
  await db.collection('poems').doc(id).set(data);
  res.json({ id, ...data });
});

poemsRouter.put('/order', requireAuth, async (req, res) => {
  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids)) {
    res.status(400).json({ error: 'ids must be an array' });
    return;
  }
  await db.collection('config').doc('poemOrder').set({ ids });
  res.json({ ok: true });
});

poemsRouter.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, overlay, image, featured, deleted, customSlides, customSlidesEnabled } =
    req.body as {
      title?: string;
      overlay?: string;
      image?: string;
      featured?: boolean;
      deleted?: boolean;
      customSlides?: string[];
      customSlidesEnabled?: boolean;
    };
  const data: Record<string, string | boolean | string[]> = {};
  if (title !== undefined) data.title = title;
  if (overlay !== undefined) data.overlay = overlay;
  if (image !== undefined) data.image = image;
  if (featured !== undefined) data.featured = featured;
  if (deleted !== undefined) data.deleted = deleted;
  if (customSlides !== undefined) data.customSlides = customSlides;
  if (customSlidesEnabled !== undefined) data.customSlidesEnabled = customSlidesEnabled;
  await db.collection('poems').doc(id).set(data, { merge: true });
  res.json({ ok: true });
});

poemsRouter.delete('/:id', requireAuth, async (req, res) => {
  await db.collection('poems').doc(req.params.id).delete();
  res.json({ ok: true });
});

poemsRouter.post('/:id/image', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }
  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: 'poems', public_id: `${req.params.id}-${Date.now()}` },
          (error, result) => (error ? reject(error) : resolve(result as { secure_url: string })),
        )
        .end(req.file!.buffer);
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Image upload failed:', err);
    res.status(500).json({ error: 'Image upload failed' });
  }
});
