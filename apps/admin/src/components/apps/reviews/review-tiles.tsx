import { formatNumber } from '@commerce/money'
import { Card } from '@commerce/ui/shadcn/card'
import type { ReactNode } from 'react'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import ReviewStars from './review-stars'

type Stats = {
  all: number
  pending: number
  published: number
  average: number | null
  withPhotos: number
}

type ReviewTilesProps = { stats: Stats }

type TileProps = { title: string; value: ReactNode; period: string }

const figure = (n: number | string) => (
  <span className="text-stat text-ink-strong tabular-nums">{n}</span>
)

/* Same tile as the gift card and order lists: title, figure, period line. */
function Tile({ title, value, period }: TileProps) {
  return (
    <Card gap="none" inset={4} className="h-[6.5rem] rounded-lg">
      <p className="text-card-title">{title}</p>
      <div className="mt-3 flex items-center gap-2">{value}</div>
      <p className="mt-1.5 text-period text-muted-foreground">{period}</p>
    </Card>
  )
}

/** Average rating, published, waiting and with-photos counts above the reviews table. */
export default function ReviewTiles({ stats }: ReviewTilesProps) {
  // Hooks
  const copy = useCopy(reviewsContent)

  // Render logic
  const t = copy.list.tiles
  const pct = stats.all > 0 ? Math.round((stats.withPhotos / stats.all) * 100) : 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        title={t.average}
        value={
          stats.average === null ? (
            figure('0')
          ) : (
            <>
              {figure(stats.average.toFixed(1))}
              <ReviewStars value={stats.average} label={copy.stars(stats.average)} size="md" />
            </>
          )
        }
        period={stats.average === null ? t.noAverage : t.averageFrom(stats.published)}
      />
      <Tile
        title={t.published}
        value={figure(formatNumber(stats.published))}
        period={t.publishedHelp}
      />
      <Tile title={t.waiting} value={figure(formatNumber(stats.pending))} period={t.waitingHelp} />
      <Tile
        title={t.photos}
        value={figure(formatNumber(stats.withPhotos))}
        period={t.photosHelp(pct)}
      />
    </div>
  )
}
