import { formatNumber } from '@commerce/money'
import StatTile from '@/components/layout/stat-tile'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'

type Stats = {
  all: number
  pending: number
  published: number
  average: number | null
  withPhotos: number
}

type ReviewTilesProps = {
  stats: Stats
  /** The status filter on the table: published and waiting tiles act as filters. */
  status: 'pending' | 'published' | 'hidden' | null
  onStatus: (status: 'pending' | 'published' | null) => void
}

/** Average rating, published, waiting and with-photos counts above the reviews table. */
export default function ReviewTiles({ stats, status, onStatus }: ReviewTilesProps) {
  // Hooks
  const copy = useCopy(reviewsContent)

  // Render logic
  const t = copy.list.tiles

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label={t.average} value={stats.average === null ? '0' : stats.average.toFixed(1)} />
      <StatTile
        label={t.published}
        value={formatNumber(stats.published)}
        active={status === 'published'}
        onSelect={() => onStatus(status === 'published' ? null : 'published')}
      />
      <StatTile
        label={t.waiting}
        value={formatNumber(stats.pending)}
        active={status === 'pending'}
        onSelect={() => onStatus(status === 'pending' ? null : 'pending')}
      />
      <StatTile label={t.photos} value={formatNumber(stats.withPhotos)} />
    </div>
  )
}
