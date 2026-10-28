import type { AuthStore } from '../authState';

/**
 * In-memory stand-in for the slice of Firestore that authState uses.
 *
 * Small enough to read in one go, which matters: a stand-in that quietly behaves unlike the
 * real thing turns a passing suite into a false negative. It models the two behaviours the
 * code depends on — `exists` being false for an unwritten document, and `data()` returning
 * whatever was last set — and nothing else.
 */
export function createFakeStore(): AuthStore & {
  /** Every document, for asserting on what was written. */
  dump(): Record<string, Record<string, unknown>>;
  /** Makes every operation reject, to exercise the fail-open paths. */
  breakWith(message: string): void;
} {
  const docs = new Map<string, Record<string, unknown>>();
  let broken: string | null = null;

  const fail = () => {
    if (broken) throw new Error(broken);
  };

  return {
    collection(name: string) {
      return {
        doc(id: string) {
          const key = `${name}/${id}`;
          return {
            async get() {
              fail();
              const value = docs.get(key);
              return {
                exists: value !== undefined,
                data: () => value,
              };
            },
            async set(value: Record<string, unknown>) {
              fail();
              docs.set(key, value);
              return undefined;
            },
            async delete() {
              fail();
              docs.delete(key);
              return undefined;
            },
          };
        },
      };
    },
    dump: () => Object.fromEntries(docs),
    breakWith(message: string) {
      broken = message;
    },
  };
}
