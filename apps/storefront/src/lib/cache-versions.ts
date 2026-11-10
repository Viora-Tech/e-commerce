/**
 * Which cached storefront data is still good, per store. Every cache key carries a store's
 * stamp (`<epoch>.<version>`); a new stamp means every older entry for that store is never read
 * again (and ages out of the LRU). Pure: the Postgres listener (`cache-stamp.ts`) feeds it.
 *
 * - A hard notification (a write to a rendered table) bumps the store's version at once.
 * - A soft one (media processing) bumps it once the images go quiet for `softDelayMs`, and at
 *   most every `SOFT_MAX_WAIT_MS` during a long batch: a bulk photo upload used to empty the
 *   whole store's cache every minute for its length (#1471, 10 Nov 2026).
 * - The store's next scheduled change (a launch, a discount ending) bumps it when it passes.
 * - Losing the listener stops all caching (`stamp` is null); getting it back starts a new epoch,
 *   so nothing cached before the gap is trusted.
 */

type StoreState = {
  version: number
  /** When a pending soft notification takes effect. */
  softAt: number | null
  /** When the first soft notification of the pending batch arrived. */
  softSince: number | null
  /** Next scheduled change: undefined until looked up for this version, null for none. */
  boundary: number | null | undefined
}

/** How long soft notifications wait before they take effect (media processing). */
export const SOFT_DELAY_MS = 60_000

/** The longest a stream of soft notifications can hold its bump back. */
export const SOFT_MAX_WAIT_MS = 10 * 60_000

export type StoreVersionsOptions = {
  now?: () => number
  /** How long soft notifications wait (and coalesce) before they bump the version. */
  softDelayMs?: number
}

export class StoreVersions {
  readonly #stores = new Map<string, StoreState>()
  readonly #now: () => number
  readonly #softDelayMs: number
  #epoch = 0
  #live = false

  constructor(options: StoreVersionsOptions = {}) {
    this.#now = options.now ?? Date.now
    this.#softDelayMs = options.softDelayMs ?? SOFT_DELAY_MS
  }

  /** True while notifications are arriving; caching is off otherwise. */
  get live(): boolean {
    return this.#live
  }

  /** The listener is (again) listening: a new epoch, every store starts over. */
  connected(): void {
    this.#epoch++
    this.#stores.clear()
    this.#live = true
  }

  /** The listener lost its connection: notifications may be missed until `connected`. */
  disconnected(): void {
    this.#live = false
  }

  /** A `storefront_cache` notification for one store. */
  notify(storeId: string, soft: boolean): void {
    const state = this.#state(storeId)
    if (!soft) {
      state.version++
      state.softAt = null
      state.softSince = null
      state.boundary = undefined
      return
    }
    // Wait for the batch to go quiet, but never longer than SOFT_MAX_WAIT_MS from its start.
    const now = this.#now()
    state.softSince ??= now
    state.softAt = Math.min(now + this.#softDelayMs, state.softSince + SOFT_MAX_WAIT_MS)
  }

  /** The store's current stamp, or null while caching is off. */
  stamp(storeId: string): string | null {
    if (!this.#live) return null
    const state = this.#state(storeId)
    const now = this.#now()
    if (state.softAt !== null && now >= state.softAt) {
      state.version++
      state.softAt = null
      state.softSince = null
      state.boundary = undefined
    }
    if (typeof state.boundary === 'number' && now >= state.boundary) {
      state.version++
      state.boundary = undefined
    }
    return `${this.#epoch}.${state.version}`
  }

  /** Whether the store's next scheduled change still has to be looked up for this version. */
  needsBoundary(storeId: string): boolean {
    return this.#state(storeId).boundary === undefined
  }

  /** Records the next scheduled change, if `stamp` is still current (no write since the lookup). */
  setBoundary(storeId: string, stamp: string, at: number | null): void {
    if (this.stamp(storeId) !== stamp) return
    this.#state(storeId).boundary = at
  }

  #state(storeId: string): StoreState {
    let state = this.#stores.get(storeId)
    if (!state) {
      state = { version: 0, softAt: null, softSince: null, boundary: undefined }
      this.#stores.set(storeId, state)
    }
    return state
  }
}
