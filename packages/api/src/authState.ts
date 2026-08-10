/**
 * Login state that has to outlive the process.
 *
 * The in-memory limiter this replaces reset on every restart, and Render's free tier
 * restarts whenever the instance spins down or a deploy lands — so the window a determined
 * attacker had to wait out was minutes, not the quarter hour it claimed. Firestore is
 * already a dependency and login volume is tiny, so the cost is negligible.
 *
 * Every read fails open. If Firestore is unreachable the owner must still be able to log in
 * and fix things; a lockout that triggers precisely when the database is down is worse than
 * the brute-force window it closes. The in-memory limiter in auth.ts still applies, so
 * failing open is not the same as no limit.
 */

/** The slice of the Firestore API this module uses. Narrow on purpose: it is the whole
 *  surface a stand-in has to implement. */
export interface AuthStore {
  collection(name: string): {
    doc(id: string): {
      get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
      set(value: Record<string, unknown>): Promise<unknown>;
      delete(): Promise<unknown>;
    };
  };
}

let store: AuthStore | null = null;

/**
 * Imported on first use rather than at module load. `firebaseAdmin` calls initializeApp at
 * import time and throws outright when the service-account variables are missing, which
 * made every module that touches auth impossible to load — including in tests. Deferring it
 * also means a misconfigured environment surfaces on the first request instead of taking
 * the whole process down at startup.
 */
async function getStore(): Promise<AuthStore> {
  if (!store) {
    const { db } = await import('./firebaseAdmin');
    store = db as unknown as AuthStore;
  }
  return store;
}

/** Test seam: pass a stand-in, or null to fall back to Firestore. */
export function setAuthStore(s: AuthStore | null): void {
  store = s;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/** Firestore keys cannot contain '/', which IPv6 and proxied values can. */
const keyFor = (ip: string) => encodeURIComponent(ip).replace(/%/g, '_').slice(0, 200);

export interface AttemptState {
  blocked: boolean;
  /** Failures inside the current window, used to scale the delay before answering. */
  recentFailures: number;
}

export async function recordAttempt(ip: string): Promise<AttemptState> {
  try {
    const ref = (await getStore()).collection('authAttempts').doc(keyFor(ip));
    const snap = await ref.get();
    const now = Date.now();
    const previous = (snap.exists ? ((snap.data()?.times as number[]) ?? []) : []) as number[];
    const times = previous.filter((t) => now - t < WINDOW_MS);
    if (times.length >= MAX_ATTEMPTS) {
      await ref.set({ times, updated: now });
      return { blocked: true, recentFailures: times.length };
    }
    times.push(now);
    await ref.set({ times, updated: now });
    return { blocked: false, recentFailures: times.length - 1 };
  } catch (err) {
    console.warn(`[auth] could not read attempt history (${(err as Error).message}); failing open`);
    return { blocked: false, recentFailures: 0 };
  }
}

/** Called after a correct password, so one success clears the record. */
export async function clearAttempts(ip: string): Promise<void> {
  try {
    await (await getStore()).collection('authAttempts').doc(keyFor(ip)).delete();
  } catch {
    // Nothing to do: the entries expire on their own with the window.
  }
}

// The epoch is read on every authenticated request, so it is cached briefly rather than
// fetched each time. A minute is short enough that "log out everywhere" feels immediate and
// long enough that ordinary admin use does not generate a read per click.
const EPOCH_TTL_MS = 60 * 1000;
let cached: { value: number; at: number } | null = null;

/** Test seam: drops the cached epoch so a stand-in is consulted immediately. */
export function resetEpochCache(): void {
  cached = null;
}

export async function currentEpoch(): Promise<number> {
  if (cached && Date.now() - cached.at < EPOCH_TTL_MS) return cached.value;
  try {
    const snap = await (await getStore()).collection('config').doc('authEpoch').get();
    const value = snap.exists ? ((snap.data()?.value as number) ?? 0) : 0;
    cached = { value, at: Date.now() };
    return value;
  } catch {
    // Fail open to the last known value, or 0. A Firestore blip should not log the owner
    // out of a portal they may need in order to diagnose it.
    return cached?.value ?? 0;
  }
}

/**
 * Invalidates every token issued so far by moving the epoch past them.
 *
 * The alternative was rotating JWT_SECRET on Render, which works but needs a dashboard
 * visit and restarts the API. This is the thing to reach for if a laptop goes missing.
 */
export async function revokeAllTokens(): Promise<number> {
  const value = Date.now();
  await (await getStore()).collection('config').doc('authEpoch').set({ value });
  cached = { value, at: Date.now() };
  return value;
}
