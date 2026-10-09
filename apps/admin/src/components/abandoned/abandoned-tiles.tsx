import { formatPercent } from '@commerce/money'
import StatTile from '@/components/layout/stat-tile'
import { abandonedContent as copy } from '@/data/drafts'
import { useFormat } from '@/hooks/use-copy'

export type AbandonedStats = {
  carts: number
  valuePaise: number
  recovered: number
  recoveryRate: number
}

type AbandonedTilesProps = { stats: AbandonedStats }

/** Four tiles above the table, same rhythm as the order list (frame 5:2511). */
export default function AbandonedTiles({ stats }: AbandonedTilesProps) {
  // Hooks
  const fmt = useFormat()

  return (
    <>
      <StatTile label={copy.tiles.carts} note={copy.tiles.period} value={fmt.number(stats.carts)} />
      <StatTile
        label={copy.tiles.value}
        note={copy.tiles.period}
        value={fmt.money(stats.valuePaise)}
      />
      <StatTile
        label={copy.tiles.recovered}
        note={copy.tiles.period}
        value={fmt.number(stats.recovered)}
      />
      <StatTile
        label={copy.tiles.rate}
        note={copy.tiles.period}
        value={formatPercent(stats.recoveryRate)}
      />
    </>
  )
}
