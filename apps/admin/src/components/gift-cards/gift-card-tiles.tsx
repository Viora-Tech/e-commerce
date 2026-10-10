import { formatNumber } from '@commerce/money'
import StatTile from '@/components/layout/stat-tile'
import { giftCardsContent } from '@/data/gift-cards'
import { formatPaise } from '@/lib/money'

type GiftCardTilesProps = {
  activeCount: number
  outstandingPaise: number
  products: { status: string }[]
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
    <>
      <StatTile label={t.active} value={formatNumber(activeCount)} trendNote={t.now} />
      <StatTile
        label={t.outstanding}
        value={formatPaise(outstandingPaise)}
        trendNote={t.liability}
      />
      <StatTile
        label={t.products}
        value={formatNumber(products.length)}
        trendNote={t.onSale(onSale)}
      />
    </>
  )
}
