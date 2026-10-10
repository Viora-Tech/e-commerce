'use client'

import StatTile from '@/components/layout/stat-tile'
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
  const toggle = (next: CollectionTab) => onSelect(tab === next ? null : next)

  return (
    <>
      <StatTile
        label={copy.tiles.all}
        value={fmt.number(stats.total)}
        active={tab === null}
        onSelect={() => onSelect(null)}
      />
      <StatTile
        label={copy.tiles.automatic}
        value={fmt.number(stats.automatic)}
        trendNote={copy.tiles.automaticNote}
        active={tab === 'automatic'}
        onSelect={() => toggle('automatic')}
      />
      <StatTile
        label={copy.tiles.manual}
        value={fmt.number(stats.manual)}
        trendNote={copy.tiles.manualNote}
        active={tab === 'manual'}
        onSelect={() => toggle('manual')}
      />
      <StatTile
        label={copy.tiles.empty}
        value={fmt.number(stats.empty)}
        trendNote={copy.tiles.emptyNote}
        active={tab === 'empty'}
        onSelect={() => toggle('empty')}
      />
    </>
  )
}
