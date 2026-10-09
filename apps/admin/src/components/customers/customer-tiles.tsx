'use client'

import { formatNumber } from '@commerce/money'
import { percentDelta } from '@/components/layout/delta-chip'
import StatTile from '@/components/layout/stat-tile'
import { type CustomerSegment, customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

export type CustomerStats = Awaited<ReturnType<typeof api.customers.stats>>

type CustomerTilesProps = {
  stats: CustomerStats
  /** The list tab the tiles filter by; null is "All customers". */
  active: CustomerSegment | null
  onSelect: (segment: CustomerSegment | null) => void
}

function rounded(delta: number | null): number | null {
  return delta === null ? null : Math.round(delta)
}

/**
 * Four stat cards above the list (Figma "Customers / Customers list"). Each one is also a
 * filter: pressing it picks the matching tab, pressing the active one goes back to all.
 */
export default function CustomerTiles({ stats, active, onSelect }: CustomerTilesProps) {
  // Hooks
  const content = useCopy(customersContent)

  // Event handlers
  const handlePick = (segment: CustomerSegment | null) =>
    onSelect(active === segment ? null : segment)

  // Render logic
  const copy = content.stats
  const repeatShare = stats.total === 0 ? 0 : Math.round((stats.returning / stats.total) * 100)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label={copy.total}
        value={formatNumber(stats.total)}
        trend={rounded(percentDelta(stats.total, stats.totalPrevious))}
        trendNote={copy.vsLastWeek}
        active={active === null}
        onSelect={() => onSelect(null)}
      />
      <StatTile
        label={copy.newCustomers}
        value={formatNumber(stats.newLast7)}
        trend={rounded(percentDelta(stats.newLast7, stats.newPrevious7))}
        trendNote={copy.vsLastWeek}
        active={active === 'new'}
        onSelect={() => handlePick('new')}
      />
      <StatTile
        label={copy.repeat}
        value={formatNumber(stats.returning)}
        note={copy.shareOfAll(repeatShare)}
        active={active === 'returning'}
        onSelect={() => handlePick('returning')}
      />
      <StatTile
        label={copy.subscribed}
        value={formatNumber(stats.marketing)}
        note={copy.canGetEmails}
        active={active === 'subscribed'}
        onSelect={() => handlePick('subscribed')}
      />
    </div>
  )
}
