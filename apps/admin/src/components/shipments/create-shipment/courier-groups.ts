import type { CourierRateRow } from '@commerce/core'

/**
 * The aggregator or courier a rate row belongs to, read from its label: "Xpressbees · Surface
 * via Shiprocket" is Shiprocket, "Delhivery · Express" is Delhivery. The quote has no separate
 * provider field, so the label's own wording is the grouping.
 */
export function courierGroup(label: string): string {
  const via = label.split(' via ')[1]?.trim()
  if (via) return via
  return label.split(' · ')[0]?.trim() || label
}

/** Each group in first-seen order with how many rate rows it holds. */
export function groupCounts(options: CourierRateRow[]): Array<{ group: string; count: number }> {
  const counts = new Map<string, number>()
  for (const o of options) {
    const group = courierGroup(o.providerLabel)
    counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  return [...counts].map(([group, count]) => ({ group, count }))
}

/** Two letters for a courier's logo tile: "Blue Dart" is BD, "Delhivery · Surface" is DE. */
export function courierInitials(label: string): string {
  const name = label.split(' · ')[0]?.split(' via ')[0]?.trim() ?? label
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
