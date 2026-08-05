import type { Section, Settings } from '@hamstarter/shared';

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

const TOKEN_KEY = 'admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/** Every admin request funnels through here so a revoked token logs out once, not per call. */
async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${getToken() ?? ''}`,
      ...init.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
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

export async function apiGetContent(): Promise<Section[]> {
  const res = await fetch(`${BASE}/api/content`);
  if (!res.ok) throw new Error('Failed to fetch content');
  return res.json() as Promise<Section[]>;
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
