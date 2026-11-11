import type { CourierRateRow } from '@commerce/core'

/** Each connected courier account (Delhivery, Shiprocket) in first-seen order with how many
 *  rate rows it holds: Shiprocket's carriers group under Shiprocket. */
export function groupCounts(options: CourierRateRow[]): Array<{ group: string; count: number }> {
  const counts = new Map<string, number>()
  for (const o of options) {
    const group = o.providerName
    counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  return [...counts].map(([group, count]) => ({ group, count }))
}

/** Two letters for a courier's logo tile: "Blue Dart" is BD, "Delhivery Surface (Shiprocket)"
 *  is DS: the carrier's name, never the aggregator in brackets. */
export function courierInitials(label: string): string {
  const name = label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label
  const words = name.split(/\s+/).filter(Boolean)
  const letters =
    words.length > 1
      ? words
          .slice(0, 2)
          .map((w) => w[0])
          .join('')
      : name.slice(0, 2)
  return letters.toUpperCase()
}

/** The drawer's Air / Surface tabs (Figma 898:7790): air, express and priority services fly. */
export type CourierMode = 'air' | 'surface'

const AIR = /\b(air|express|priority|apex|premium)\b/i

export function courierMode(
  row: Pick<CourierRateRow, 'providerLabel' | 'serviceLabel'>,
): CourierMode {
  return AIR.test(`${row.providerLabel} ${row.serviceLabel ?? ''}`) ? 'air' : 'surface'
}

export type CourierSort = 'recommended' | 'cheapest' | 'fastest'

/**
 * The drawer's Sort: Recommended keeps the server's order with the badged rows first;
 * Cheapest by price, Fastest by delivery date. A courier that cannot take the parcel, or has
 * no price, always sinks to the bottom.
 */
export function sortCourierRows(
  rows: readonly CourierRateRow[],
  sort: CourierSort,
): CourierRateRow[] {
  const rank = (r: CourierRateRow) => (r.problem !== null ? 2 : r.pricePaise === null ? 1 : 0)
  const badge = (r: CourierRateRow) =>
    r.badges.includes('recommended') ? 0 : r.badges.length > 0 ? 1 : 2
  const key = (r: CourierRateRow): number =>
    sort === 'cheapest'
      ? (r.pricePaise ?? Number.MAX_SAFE_INTEGER)
      : sort === 'fastest'
        ? r.deliveryBy
          ? Date.parse(r.deliveryBy)
          : Number.MAX_SAFE_INTEGER
        : badge(r)
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || key(a.r) - key(b.r) || a.i - b.i)
    .map(({ r }) => r)
}
