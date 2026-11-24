import type { loyaltyContent } from '@/data/loyalty'

type Entry = { source: string; status: string; points: number }

/**
 * What a points history line was, for the customer page: the source, then its status. Staff
 * changes read Added or Removed; a line that took points away never says Credited (the
 * status only means the change went through).
 */
export function pointsEntryKind(e: Entry, copy: typeof loyaltyContent): string {
  if (e.source === 'adjustment') return e.points < 0 ? copy.adjustRemoved : copy.adjustAdded
  const source = copy.sources[e.source] ?? e.source
  if (e.points < 0 && e.status === 'credited') return source
  return `${source} · ${copy.statuses[e.status] ?? e.status}`
}
