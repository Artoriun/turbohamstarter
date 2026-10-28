import { cert, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';

/**
 * Firestore, or a stand-in that fails cleanly when it is not configured.
 *
 * `admin.credential.cert()` throws on a missing project_id, so initialising unconditionally
 * meant the whole API refused to boot on a fresh clone — before any route could decide to
 * fall back. Since GET /api/content is designed to serve bundled content when Firestore is
 * unreachable, "unreachable" has to include "never configured", or the starter cannot run
 * until you have signed up for Firebase.
 *
 * The stub rejects rather than resolving empty. A read that resolved to no documents is
 * indistinguishable from a real empty collection, so the content route would treat it as
 * "everything has been deleted" and serve nothing. Rejecting routes it to the fallback
 * path that already exists.
 */
const configured = !!(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

const NOT_CONFIGURED = 'Firestore is not configured (set FIREBASE_* in packages/api/.env)';

/** Shaped like the slice of the Firestore API this project actually uses. */
type Store = Pick<Firestore, 'collection'>;

function stubStore(): Store {
  const reject = () => Promise.reject(new Error(NOT_CONFIGURED));
  const doc = () => ({ get: reject, set: reject, delete: reject });
  const collection = () => ({ get: reject, doc });
  return { collection } as unknown as Store;
}

export const isFirestoreConfigured = configured;

const real: Store = configured
  ? getFirestore(
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      }),
    )
  : stubStore();

let override: Store | null = null;

/**
 * Swaps the store every route sees, for tests. One switch rather than an injection point
 * per module: `db` is imported as a binding all over the API, so reassigning it would not
 * reach the modules that already hold it — the proxy below forwards each access instead,
 * which means a swap applies everywhere immediately.
 *
 * Pass null to restore. Nothing in the running app calls this.
 */
export function setStore(store: Store | null): void {
  override = store;
}

export const db: Store = new Proxy({} as Store, {
  get: (_target, prop: string | symbol) => (override ?? real)[prop as keyof Store],
});
