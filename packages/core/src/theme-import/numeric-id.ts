/** SOURCE OF TRUTH: Shopify-style numeric ids for imported themes — WHAT: a product's or variant's id as a whole number (from the time-ordered UUID: 41 bits of milliseconds since 2020 and the 12 random bits after the version), and the way back to the UUID prefix / WHY: theme Liquid writes ids into JSON unquoted (`"id": {{ variant.id }}`) because Shopify's are numbers; our UUIDs there break the theme's scripts. The number fits in a JavaScript safe integer, so it survives the theme's JSON and comes back to our cart intact */

/** 2020-01-01T00:00:00Z: ids count milliseconds from here, so the number stays under 2^53 until 2089. */
const EPOCH = 1_577_836_800_000
const RAND_BITS = 4096

const UUID_V7 = /^([0-9a-f]{8})-([0-9a-f]{4})-7([0-9a-f]{3})-/i

/** The whole-number id a theme sees, or the UUID unchanged when it is not a v7 UUID. */
export function numericId(uuid: string): number | string {
  const m = UUID_V7.exec(uuid)
  if (!m) return uuid
  const ms = Number.parseInt(`${m[1]}${m[2]}`, 16) - EPOCH
  if (ms < 0) return uuid
  return ms * RAND_BITS + Number.parseInt(m[3] as string, 16)
}

/**
 * The UUID prefix (`xxxxxxxx-xxxx-7xxx-`) a numeric id came from, for a `like` lookup;
 * null when the value is not one of ours.
 */
export function uuidPrefixOf(value: string | number): string | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(n) || n < 0) return null
  const rand = n % RAND_BITS
  const ms = (n - rand) / RAND_BITS + EPOCH
  const hex = ms.toString(16).padStart(12, '0')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${rand.toString(16).padStart(3, '0')}-`
}
