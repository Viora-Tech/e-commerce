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
