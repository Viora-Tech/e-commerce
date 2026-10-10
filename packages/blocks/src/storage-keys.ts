/**
 * SOURCE OF TRUTH KEYWORDS: storageKey, readStored, zero-drift:, glide:
 * WHAT:  Names of the browser storage entries the Zero Drift sections keep (signup popup
 *        timing, the size table's units), and the one way to read them.
 * WHY:   Until the theme was renamed these were saved under `glide:`. Shoppers' browsers still
 *        hold those, so a read falls back to the old name: someone who signed up or chose
 *        inches keeps that. New writes use `zero-drift:` only.
 * WHERE: `components/sections/zero-drift/signup-popup-timing.ts`, `product-size-table.tsx`.
 */

const PREFIX = 'zero-drift:'
const LEGACY_PREFIX = 'glide:'

/** The storage key for a Zero Drift setting, e.g. `storageKey('subscribed')`. */
export const storageKey = (name: string): string => `${PREFIX}${name}`

/** A stored value under its key, or under the name it had before the rename. */
export function readStored(storage: Pick<Storage, 'getItem'>, key: string): string | null {
  const value = storage.getItem(key)
  if (value !== null || !key.startsWith(PREFIX)) return value
  return storage.getItem(`${LEGACY_PREFIX}${key.slice(PREFIX.length)}`)
}
