import { formatInZone, IST_OFFSET_MS } from '@commerce/dates'

/** The months the Returns tab offers: the last twelve, newest first. */
const MONTHS_SHOWN = 12

/** The last twelve `YYYY-MM` months, newest first, in IST. */
export function recentMonths(now = new Date()): string[] {
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

/** [start, end) of a `YYYY-MM` month as instants (midnight IST). */
export function monthRange(period: string) {
  const [y, m] = period.split('-').map(Number) as [number, number]
  return {
    from: new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS),
    to: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS),
  }
}

/** "September 2026". */
export const monthLabel = (period: string) =>
  formatInZone(
    monthRange(period).to.getTime() - 86_400_000,
    { month: 'long', year: 'numeric' },
    { timeZone: 'UTC' },
  )
