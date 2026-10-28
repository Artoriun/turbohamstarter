const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/^http:\/\//, 'https://');

/** Never report the same message twice in one page life — a component that throws on every
 *  render would otherwise send one per attempt. */
const seen = new Set<string>();

/**
 * Sends an error to the API, which logs it server-side.
 *
 * Deliberately quiet: it never throws, never retries, and ignores whatever comes back. This
 * runs on a page that has already gone wrong, and a failed report must not make that worse.
 * `keepalive` lets it survive the navigation if the visitor leaves immediately.
 */
export function reportError(error: Error, component?: string): void {
  const message = error.message || String(error);
  if (seen.has(message)) return;
  seen.add(message);

  try {
    void fetch(`${BASE}/api/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        stack: error.stack,
        url: window.location.href,
        component,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting is best effort; there is nowhere useful to escalate to.
  }
}

/**
 * Catches what the error boundary cannot: errors thrown outside React's render cycle, and
 * promise rejections nothing handled.
 */
export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (event) => {
    if (event.error instanceof Error) reportError(event.error, 'window.onerror');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportError(reason instanceof Error ? reason : new Error(String(reason)), 'unhandledrejection');
  });
}
