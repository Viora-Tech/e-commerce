'use client'

import StatStrip from '@/components/layout/stat-strip'
import { type DiscountLifecycle, discountsContent } from '@/data/discounts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

export type DiscountStats = Awaited<ReturnType<typeof api.discounts.stats>>

type DiscountTilesProps = {
  stats: DiscountStats
  status: DiscountLifecycle | null
  /** Picks the lifecycle a tile filters to; a tile that is already on clears itself. */
  onSelect: (status: DiscountLifecycle | null) => void
}

/** The four stat tiles over the discount list; the first three filter the table below. */
export default function DiscountTiles({ stats, status, onSelect }: DiscountTilesProps) {
  // Hooks
  const { tiles } = useCopy(discountsContent)
  const fmt = useFormat()

  // Render logic
  return (
    <StatStrip
      active={status}
      onChange={onSelect}
      tiles={[
        {
          id: 'active',
          label: tiles.active,
          value: fmt.number(stats.active),
          note: tiles.activeNote,
          filter: 'active',
        },
        {
          id: 'scheduled',
          label: tiles.scheduled,
          value: fmt.number(stats.scheduled),
          note: tiles.scheduledNote,
          filter: 'scheduled',
        },
        {
          id: 'expired',
          label: tiles.expired,
          value: fmt.number(stats.expired),
          note: tiles.expiredNote,
          filter: 'expired',
        },
        {
          id: 'used',
          label: tiles.usedThisMonth,
          value: fmt.number(stats.usedThisMonth),
          note: tiles.month,
        },
      ]}
    />
  )
}
