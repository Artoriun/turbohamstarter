/**
 * Cloudflare Web Analytics: cookie-less, so it needs no consent banner. Loaded imperatively
 * rather than as a static <script> in index.html so an unset token means zero requests, not
 * one with an empty token — Vite's %ENV% substitution in HTML warns and leaves the literal
 * placeholder text behind when a variable is entirely unset (as opposed to set-but-empty),
 * which would make this truthy by accident on exactly the forks that never configured it.
 */
export function loadAnalytics(): void {
  const token = import.meta.env.VITE_CF_BEACON_TOKEN;
  if (!token) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute('data-cf-beacon', JSON.stringify({ token }));
  document.head.appendChild(script);
}
