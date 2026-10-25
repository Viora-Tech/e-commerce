'use client'

import { formatNumber } from '@commerce/money'
import StatStrip from '@/components/layout/stat-strip'
import { type CustomerSegment, customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { percent } from '@/lib/stats'

export type CustomerStats = Awaited<ReturnType<typeof api.customers.stats>>

type CustomerTilesProps = {
  stats: CustomerStats
  /** The list tab the tiles filter by; null is "All customers". */
  active: CustomerSegment | null
  onSelect: (segment: CustomerSegment | null) => void
}

/**
 * Four stat cards above the list (Figma "Customers / Customers list"). Each one is also a
 * filter: pressing it picks the matching tab, pressing the active one goes back to all.
 */
export default function CustomerTiles({ stats, active, onSelect }: CustomerTilesProps) {
  // Hooks
  const content = useCopy(customersContent)

  // Render logic
  const copy = content.stats
  const repeatShare = stats.total === 0 ? 0 : Math.round((stats.returning / stats.total) * 100)

  return (
    <StatStrip
      active={active}
      onChange={onSelect}
      tiles={[
        {
          id: 'total',
          label: copy.total,
          value: formatNumber(stats.total),
          trend: percent(stats.total, stats.totalPrevious),
          trendNote: copy.vsLastWeek,
          filter: null,
        },
        {
          id: 'new',
          label: copy.newCustomers,
          value: formatNumber(stats.newLast7),
          trend: percent(stats.newLast7, stats.newPrevious7),
          trendNote: copy.vsLastWeek,
          filter: 'new',
        },
        {
          id: 'repeat',
          label: copy.repeat,
          value: formatNumber(stats.returning),
          note: copy.shareOfAll(repeatShare),
          filter: 'returning',
        },
        {
          id: 'subscribed',
          label: copy.subscribed,
          value: formatNumber(stats.marketing),
          note: copy.canGetEmails,
          filter: 'subscribed',
        },
      ]}
    />
  )
}
