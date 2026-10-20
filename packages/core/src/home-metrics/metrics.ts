/** SOURCE OF TRUTH: Home analytics tile metrics — WHAT: the metrics a member can pin to a tile / WHY: one list for the picker and the stats */
/**
 * The metrics a Home analytics tile can show (Figma "Choose a metric for this slot", 580:692).
 * Each member picks which four sit in the tiles; the choice lives on their store membership
 * (`store_member.home_tiles`), so it follows them across devices.
 */
export const HOME_METRICS = [
  'sales',
  'orders',
  'aov',
  'sessions',
  'visitors',
  'conversion',
  'returning',
  'gross',
  'refunds',
  'discounts',
  'gst',
  'codShare',
  'abandoned',
  'shipping',
  'topProducts',
] as const

export type HomeMetric = (typeof HOME_METRICS)[number]

/** The four tiles before a member customises them, in Shopify's order (owner 2026-10-20). */
export const DEFAULT_HOME_TILES: readonly HomeMetric[] = [
  'sessions',
  'sales',
  'orders',
  'conversion',
]

/** The defaults before sessions led; a member who saved exactly these gets the new order. */
const PREVIOUS_DEFAULT_TILES = ['sales', 'orders', 'visitors', 'conversion']

export const HOME_TILE_COUNT = 4

/** A stored choice back as four known metrics; anything missing or unknown falls back per slot. */
export function parseHomeTiles(value: unknown): HomeMetric[] {
  const list = Array.isArray(value) ? value : []
  if (
    list.length === PREVIOUS_DEFAULT_TILES.length &&
    list.every((m, i) => m === PREVIOUS_DEFAULT_TILES[i])
  ) {
    return [...DEFAULT_HOME_TILES]
  }
  return DEFAULT_HOME_TILES.map((fallback, i) => {
    const picked = list[i]
    return HOME_METRICS.includes(picked) ? (picked as HomeMetric) : fallback
  })
}
