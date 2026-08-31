/**
 * The admin session token, as the browser sees it.
 *
 * Separate from api.ts so it can be unit-tested: api.ts reads `import.meta.env`, which only
 * exists under Vite. The expiry check is the part worth testing — without it a tab left open
 * past the 7-day expiry keeps showing a fully working-looking dashboard until something
 * happens to fail.
 */

const TOKEN_KEY = 'admin_token';

/**
 * Fired when the session is over — the stored token has expired, or the server refused it.
 * The portal listens and swaps in the sign-in form rather than failing an action mid-edit.
 */
export const SESSION_EXPIRED_EVENT = 'admin-session-expired';

/** Seconds of life left in a token; 0 if it is expired or not readable as a JWT. */
export function secondsLeft(token: string): number {
  try {
    const [, payload] = token.split('.');
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    if (typeof exp !== 'number') return 0;
    return Math.max(0, exp - Date.now() / 1000);
  } catch {
    return 0;
  }
}

/**
 * The stored token if it is still valid, else null — clearing the dead one on the way out.
 *
 * This is a claim check, not a verification: only the server can check the signature, and it
 * does so on every request. The point here is to notice an expiry we already know about
 * instead of making a round trip to be told.
 */
export function readToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (secondsLeft(token) > 0) return token;
  localStorage.removeItem(TOKEN_KEY);
  return null;
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Ends the session and tells the portal why. */
export function signalSessionExpired(): void {
  clearToken();
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
