'use client'

import StatTile from '@/components/layout/stat-tile'
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
    <>
      <StatTile
        label={tiles.active}
        value={fmt.number(stats.active)}
        active={status === 'active'}
        onSelect={() => onSelect(status === 'active' ? null : 'active')}
      />
      <StatTile
        label={tiles.scheduled}
        value={fmt.number(stats.scheduled)}
        active={status === 'scheduled'}
        onSelect={() => onSelect(status === 'scheduled' ? null : 'scheduled')}
      />
      <StatTile
        label={tiles.expired}
        value={fmt.number(stats.expired)}
        active={status === 'expired'}
        onSelect={() => onSelect(status === 'expired' ? null : 'expired')}
      />
      <StatTile label={tiles.usedThisMonth} value={fmt.number(stats.usedThisMonth)} />
    </>
  )
}
