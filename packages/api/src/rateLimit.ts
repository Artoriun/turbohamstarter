/**
 * Per-IP fixed-window rate limiting.
 *
 * In-memory, so the window resets on restart and is per-instance. Fine while the API is a
 * single Render container; move to Redis or a provider-side limit if it ever scales out.
 * It exists to blunt a script, not to be airtight.
 */
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();

  return function rateLimited(ip: string): boolean {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(ip, recent);
      return true;
    }
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear(); // crude guard against unbounded growth
    return false;
  };
}
