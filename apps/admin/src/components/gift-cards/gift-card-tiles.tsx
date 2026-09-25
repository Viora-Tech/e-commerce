import { formatNumber } from '@commerce/money'
import { Card } from '@commerce/ui/shadcn/card'
import { giftCardsContent } from '@/data/gift-cards'
import { formatPaise } from '@/lib/money'

type GiftCardTilesProps = {
  activeCount: number
  outstandingPaise: number
  products: { status: string }[]
}

type TileProps = { title: string; value: string; period: string }

/* Same tile as the order and discount lists (frame 5:2512): title, figure, period line. */
function Tile({ title, value, period }: TileProps) {
  return (
    <Card className="h-[6.5rem] gap-0 rounded-lg p-4">
      <p className="text-card-title">{title}</p>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-stat text-ink-strong tabular-nums">{value}</span>
      </div>
      <p className="mt-1.5 text-period text-muted-foreground">{period}</p>
    </Card>
  )
}

/** Active cards, what the store owes on them, and the gift card products on sale. */
export default function GiftCardTiles({
  activeCount,
  outstandingPaise,
  products,
}: GiftCardTilesProps) {
  // Render logic
  const t = giftCardsContent.tiles
  const onSale = products.filter((p) => p.status === 'active').length

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Tile title={t.active} value={formatNumber(activeCount)} period={t.now} />
      <Tile title={t.outstanding} value={formatPaise(outstandingPaise)} period={t.liability} />
      <Tile title={t.products} value={formatNumber(products.length)} period={t.onSale(onSale)} />
    </div>
  )
}
