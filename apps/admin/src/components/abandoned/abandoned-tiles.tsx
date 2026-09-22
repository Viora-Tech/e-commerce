import StatCard from '@/components/layout/stat-card'
import { abandonedContent as copy } from '@/data/drafts'
import { formatPaise } from '@/lib/money'

export type AbandonedStats = {
  carts: number
  valuePaise: number
  recovered: number
  recoveryRate: number
}

type AbandonedTilesProps = { stats: AbandonedStats }

const percent = new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 0 })

/** Four tiles above the table, same rhythm as the order list (frame 5:2511). */
export default function AbandonedTiles({ stats }: AbandonedTilesProps) {
  // Render logic
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard title={copy.tiles.carts} period={copy.tiles.period} value={String(stats.carts)} />
      <StatCard
        title={copy.tiles.value}
        period={copy.tiles.period}
        value={formatPaise(stats.valuePaise)}
      />
      <StatCard
        title={copy.tiles.recovered}
        period={copy.tiles.period}
        value={String(stats.recovered)}
      />
      <StatCard
        title={copy.tiles.rate}
        period={copy.tiles.period}
        value={percent.format(stats.recoveryRate)}
      />
    </div>
  )
}
