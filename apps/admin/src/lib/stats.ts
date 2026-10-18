/** Percent change, or null when there is nothing to compare with (a first day or week). */
export function percent(value: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((value - previous) / previous) * 100)
}
