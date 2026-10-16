/**
 * The metrics a Home analytics tile can show (Figma "Choose a metric for this slot", 580:692).
 * Each member picks which four sit in the tiles; the choice lives on their store membership
 * (`store_member.home_tiles`), so it follows them across devices.
 */
export const HOME_METRICS = [
  'sales',
  'orders',
  'aov',
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

/** The four tiles before a member customises them (Figma Home: sales, orders, visitors, conversion). */
export const DEFAULT_HOME_TILES: readonly HomeMetric[] = [
  'sales',
  'orders',
  'visitors',
  'conversion',
]

export const HOME_TILE_COUNT = 4

/** A stored choice back as four known metrics; anything missing or unknown falls back per slot. */
export function parseHomeTiles(value: unknown): HomeMetric[] {
  const list = Array.isArray(value) ? value : []
  return DEFAULT_HOME_TILES.map((fallback, i) => {
    const picked = list[i]
    return HOME_METRICS.includes(picked) ? (picked as HomeMetric) : fallback
  })
}
