import { DEFAULT_SETTINGS, type Settings } from '@hamstarter/shared';
import { Router } from 'express';
import { asyncHandler } from '../asyncHandler';
import { db } from '../firebaseAdmin';
import { requireAuth } from '../middleware/requireAuth';

/**
 * Site settings, which today means the profanity filter.
 *
 * Behind auth in both directions. These are not secrets, but they are of no use to a
 * visitor and exposing them publicly would advertise which words the owner has chosen to
 * block — a list that is itself the thing being kept off the page.
 */
export const settingsRouter = Router();

const DOC = 'settings';

export async function loadSettings(): Promise<Settings> {
  try {
    const doc = await db.collection('config').doc(DOC).get();
    if (!doc.exists) return DEFAULT_SETTINGS;
    const data = doc.data() as Partial<Settings>;
    return {
      profanityFilter: data.profanityFilter ?? DEFAULT_SETTINGS.profanityFilter,
      blocklist: data.blocklist,
    };
  } catch {
    /**
     * Explicitly off, not DEFAULT_SETTINGS — which is now on.
     *
     * Falling back to the default here would mean an unreadable settings document presents
     * as "blocked by the profanity filter", when the actual problem is that Firestore is
     * unreachable. The write is about to fail on its own for the same reason, so the only
     * thing this choice changes is which error the person sees, and a misleading one costs
     * them the real diagnosis.
     *
     * Safe because this is an editorial aid rather than a security control: the worst case
     * is a rude word surviving an outage that was already breaking the save.
     */
    return { profanityFilter: false };
  }
}

settingsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await loadSettings());
  }),
);

settingsRouter.put(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<Settings>;
    const next: Settings = { profanityFilter: !!body.profanityFilter };

    if (Array.isArray(body.blocklist)) {
      // Normalised on the way in so the stored list cannot accumulate blanks, casing
      // variants or duplicates that would each cost a regex pass on every keystroke.
      next.blocklist = [
        ...new Set(
          body.blocklist
            .filter((w): w is string => typeof w === 'string')
            .map((w) => w.trim().toLowerCase())
            .filter(Boolean),
        ),
      ];
    }

    await db
      .collection('config')
      .doc(DOC)
      .set({ ...next });
    res.json(next);
  }),
);
