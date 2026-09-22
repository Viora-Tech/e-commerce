import { Card } from '@commerce/ui/shadcn/card'
import CountUp from '@/components/layout/count-up'
import { collectionsListContent } from '@/data/collections'
import type { api } from '@/lib/api-client'

export type CollectionStats = Awaited<ReturnType<typeof api.collections.stats>>

type CollectionTilesProps = { stats: CollectionStats }

type TileProps = { title: string; value: string }

const number = new Intl.NumberFormat('en-IN')
const copy = collectionsListContent.tiles

/* Same 135px tile as the product and order lists (5:2512). */
function Tile({ title, value }: TileProps) {
  return (
    <Card className="h-[8.4375rem] gap-0 rounded-lg p-4">
      <p className="text-kit-title text-foreground">{title}</p>
      <div className="mt-4 flex items-end gap-2">
        <span className="text-kit-stat text-ink-strong tabular-nums">
          <CountUp value={value} />
        </span>
      </div>
      <p className="mt-2 text-kit-body text-muted-foreground">{copy.period}</p>
    </Card>
  )
}

/** The four counts above the category cards. */
export default function CollectionTiles({ stats }: CollectionTilesProps) {
  // Render logic
  return (
    <div className="grid grid-cols-2 gap-[0.9375rem] xl:grid-cols-4">
      <Tile title={copy.total} value={number.format(stats.total)} />
      <Tile title={copy.automatic} value={number.format(stats.automatic)} />
      <Tile title={copy.manual} value={number.format(stats.manual)} />
      <Tile title={copy.empty} value={number.format(stats.empty)} />
    </div>
  )
}
