type Entry<T> = { value: T; expires: number };

/**
 * A small time-bounded cache that also shares in-flight work: two requests
 * for the same grid cell wait on one upstream call instead of making two.
 * Oldest entries are dropped first once it is full.
 */
export class TtlCache<T> {
  readonly #entries = new Map<string, Entry<T>>();
  readonly #pending = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const hit = this.#entries.get(key);
    if (!hit) return undefined;
    if (hit.expires > this.now()) return hit.value;
    this.#entries.delete(key);
    return undefined;
  }

  set(key: string, value: T): void {
    this.#entries.delete(key);
    this.#entries.set(key, { value, expires: this.now() + this.ttlMs });
    while (this.#entries.size > this.maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  /** The cached value, or the result of `load`, shared with anyone asking meanwhile. */
  async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const pending = this.#pending.get(key);
    if (pending !== undefined) return pending;
    const work = load()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => this.#pending.delete(key));
    this.#pending.set(key, work);
    return work;
  }

  get size(): number {
    return this.#entries.size;
  }
}
