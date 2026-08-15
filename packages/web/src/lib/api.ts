import type { Section, Settings } from '@hamstarter/shared';
import { readToken, secondsLeft, signalSessionExpired, storeToken } from './token';

// http→https is coerced because hosts like Render answer http with a 301, and browsers
// drop the Authorization header across a redirect — so an admin write would silently 401.
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/^http:\/\//, 'https://');

/**
 * Whether there is an API to talk to at all.
 *
 * Running this starter as a plain static site is a supported choice — the content is in
 * the bundle and the prerendered HTML, so the site is complete without a backend. In that
 * case VITE_API_URL is unset and `/api/content` resolves against the static host, which
 * can only ever 404: handled in JS, but still logged by the browser as a failed request,
 * which is both noise in the console and a Lighthouse best-practices failure.
 *
 * Dev is exempt: there VITE_API_URL is normally unset because Vite proxies /api to the
 * local server instead.
 */
export const HAS_API = import.meta.env.DEV || BASE !== '';

// Re-exported so callers keep one import for the admin API. The storage and expiry logic
// lives in token.ts because it is unit-testable there — this module reads import.meta.env,
// which only exists under Vite.
export { clearToken, SESSION_EXPIRED_EVENT } from './token';
export const getToken = readToken;
export const setToken = storeToken;

/**
 * Authorization header for an admin call, or an immediate sign-out if the token is already
 * dead.
 *
 * Checking here is what makes the session end when it actually ends: without it an expired
 * token is still sent, and the admin finds out only when the action they just took fails.
 */
function authHeader(): { Authorization: string } {
  const token = readToken();
  if (!token) {
    signalSessionExpired();
    throw new Error('unauthorized');
  }
  return { Authorization: `Bearer ${token}` };
}

/** Below this, a refresh is worth a request; above it, the token has plenty of life left. */
const REFRESH_WHEN_UNDER_SECONDS = 3 * 24 * 60 * 60;

/**
 * Extends the session while the portal is in use, so an admin who logs in every few days
 * never meets the 7-day expiry at all. Silent by design: a failed refresh leaves the current
 * token in place, and if that token is genuinely dead the next real call will say so.
 */
export async function apiRefreshToken(): Promise<void> {
  const token = readToken();
  if (!token || secondsLeft(token) > REFRESH_WHEN_UNDER_SECONDS) return;
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const { token: fresh } = (await res.json()) as { token: string };
    storeToken(fresh);
  } catch {
    // Offline, or the API is asleep. The existing token is still the best one we have.
  }
}

/** Every admin request funnels through here so a revoked token logs out once, not per call. */
async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader(),
      ...init.headers,
    },
  });
  if (res.status === 401) {
    // The server refused it — expired between the check above and arriving, or revoked.
    signalSessionExpired();
    throw new Error('unauthorized');
  }
  if (res.status === 422) {
    // The profanity filter. Carries which words were refused, so the portal can say
    // something more useful than "save failed".
    const body = (await res.json().catch(() => ({}))) as { words?: string[] };
    const err = new Error('blocked') as Error & { words?: string[] };
    err.words = body.words ?? [];
    throw err;
  }
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status}`);
  return res;
}

export async function apiLogin(password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  const { token } = (await res.json()) as { token: string };
  return token;
}

/**
 * The live sections.
 *
 * The shape is checked rather than asserted. `res.json() as Promise<Section[]>` is a promise
 * to the compiler and nothing at runtime, so anything the endpoint returns flows straight
 * into the app: point /api at the wrong server — easily done, since the dev proxy targets a
 * fixed port another project may be using — and the page dies somewhere far away with
 * `sections.filter is not a function`, behind an error boundary, looking exactly like a bug
 * in whatever you just changed. Failing here instead means the caller's catch keeps the
 * bundled content and the console says what actually arrived.
 */
export async function apiGetContent(): Promise<Section[]> {
  const res = await fetch(`${BASE}/api/content`);
  if (!res.ok) throw new Error(`Failed to fetch content: HTTP ${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(
      `/api/content returned ${data === null ? 'null' : typeof data}, expected an array of ` +
        `sections — is ${BASE || 'the dev proxy'} pointing at this project's API?`,
    );
  }
  return data as Section[];
}

export async function apiCreateSection(
  page: Section['page'],
  kind?: Section['kind'],
): Promise<Section> {
  const res = await authed('/api/content', {
    method: 'POST',
    body: JSON.stringify({ page, kind }),
  });
  return res.json() as Promise<Section>;
}

export async function apiUpdateSection(id: string, patch: Partial<Section>): Promise<void> {
  await authed(`/api/content/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
}

export async function apiDeleteSection(id: string): Promise<void> {
  await authed(`/api/content/${id}`, { method: 'DELETE' });
}

export async function apiUploadImage(id: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  const res = await authed(`/api/content/${id}/image`, { method: 'POST', body: form });
  const { url } = (await res.json()) as { url: string };
  return url;
}

export async function apiGetSettings(): Promise<Settings> {
  const res = await authed('/api/settings');
  return res.json() as Promise<Settings>;
}

export async function apiUpdateSettings(settings: Settings): Promise<Settings> {
  const res = await authed('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
  return res.json() as Promise<Settings>;
}

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Honeypot — left empty by real users, filled by naive bots. */
  website?: string;
}

export async function apiSendContact(msg: ContactMessage): Promise<void> {
  // Without a deadline the button sits on "Sending…" indefinitely when the API is asleep,
  // which on a free tier is the common case rather than the rare one. 15s is long enough
  // for a cold start to finish and short enough that the user learns something.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
      signal: controller.signal,
    });
    if (res.status === 503) throw new Error('unavailable');
    if (!res.ok) throw new Error('failed');
  } finally {
    clearTimeout(timer);
  }
}
