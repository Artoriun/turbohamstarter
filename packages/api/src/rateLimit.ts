/**
 * Per-IP fixed-window rate limiting.
 *
 * In-memory, so the window resets on restart and is per-instance. Fine while the API is a
 * single Render container; move to Redis or a provider-side limit if it ever scales out.
 * It exists to blunt a script, not to be airtight.
 */
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();

  /**
   * Seconds the caller must wait, or 0 if it may proceed.
   *
   * A boolean would do for the callers that only gate on it, but the login screen counts this
   * down — and "try again later" with no idea how much later is the version of a lockout that
   * gets reported as a broken login.
   */
  return function retryAfterSeconds(ip: string): number {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(ip, recent);
      // The window frees up when its oldest hit ages out. Never rounded down to 0, which
      // would read as "go ahead" to a caller and as a stuck countdown to a person.
      return Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    }
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear(); // crude guard against unbounded growth
    return 0;
  };
}

/**
 * Consecutive-failure lockout — three wrong passwords in a row, then a pause.
 *
 * Different question from the limiter above, which counts *attempts* in a window and cannot
 * answer either half of this: how many failures in a row (a correct password resets it), and
 * how long is left (the login screen counts it down, and a lockout nobody can see gets
 * reported as a broken login).
 *
 * In memory on purpose, like the burst limiter: no round trip per attempt, and it still works
 * when Firestore is unreachable — which matters, because the persisted fifteen-minute window
 * in authState.ts deliberately fails open. A restart clears it, but thirty seconds is short
 * enough that the bypass is worth less than the round trip would cost.
 *
 * On its own this would be *looser* than the fifteen-minute window — three tries per thirty
 * seconds is 360 an hour against 40 — so it sits on top of that limit rather than replacing it.
 */
export function createLockout({ maxFailures, lockMs }: { maxFailures: number; lockMs: number }) {
  /** `until` is 0 while merely counting, and a timestamp once locked. */
  const state = new Map<string, { fails: number; until: number }>();
  const secondsLeft = (until: number) => Math.max(0, Math.ceil((until - Date.now()) / 1000));

  return {
    /** Seconds still to wait, or 0 if this address may try. */
    lockedFor(ip: string): number {
      return secondsLeft(state.get(ip)?.until ?? 0);
    },

    /** Records a wrong password. Returns the seconds locked, or 0 if there are tries left. */
    fail(ip: string): number {
      const prev = state.get(ip);
      // Retrying while locked is not a fresh strike; otherwise a script hammering the endpoint
      // would hold itself locked forever and the pause would never end.
      if (prev && secondsLeft(prev.until) > 0) return secondsLeft(prev.until);
      // A lock that has lifted starts the count over. Re-arming on the first slip afterwards
      // would leave the owner one mistype from another thirty seconds, indefinitely.
      const fails = prev && prev.until === 0 ? prev.fails + 1 : 1;
      if (state.size > 5000) state.clear(); // same crude guard as above
      if (fails < maxFailures) {
        state.set(ip, { fails, until: 0 });
        return 0;
      }
      state.set(ip, { fails: 0, until: Date.now() + lockMs });
      return Math.ceil(lockMs / 1000);
    },

    /** Called after a correct password, so one success wipes the strikes. */
    clear(ip: string): void {
      state.delete(ip);
    },
  };
}
