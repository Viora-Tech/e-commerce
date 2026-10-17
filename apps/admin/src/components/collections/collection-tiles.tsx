'use client'

import StatStrip from '@/components/layout/stat-strip'
import { collectionsListContent } from '@/data/collections'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

export type CollectionStats = Awaited<ReturnType<typeof api.collections.stats>>
export type CollectionTab = 'automatic' | 'manual' | 'empty'

type CollectionTilesProps = {
  stats: CollectionStats
  tab: CollectionTab | null
  onSelect: (tab: CollectionTab | null) => void
}

/** The four counts over the list; each one is also a filter for the table. */
export default function CollectionTiles({ stats, tab, onSelect }: CollectionTilesProps) {
  // Hooks
  const { list: copy } = useCopy(collectionsListContent)
  const fmt = useFormat()

  // Render logic
  return (
    <StatStrip
      active={tab}
      onChange={onSelect}
      tiles={[
        { id: 'all', label: copy.tiles.all, value: fmt.number(stats.total), filter: null },
        {
          id: 'automatic',
          label: copy.tiles.automatic,
          value: fmt.number(stats.automatic),
          trendNote: copy.tiles.automaticNote,
          filter: 'automatic',
        },
        {
          id: 'manual',
          label: copy.tiles.manual,
          value: fmt.number(stats.manual),
          trendNote: copy.tiles.manualNote,
          filter: 'manual',
        },
        {
          id: 'empty',
          label: copy.tiles.empty,
          value: fmt.number(stats.empty),
          trendNote: copy.tiles.emptyNote,
          filter: 'empty',
        },
      ]}
    />
  )
}
