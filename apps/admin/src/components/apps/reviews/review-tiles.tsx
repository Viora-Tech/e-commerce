import { formatNumber } from '@commerce/money'
import StatStrip from '@/components/layout/stat-strip'
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
    <StatStrip<'pending' | 'published'>
      active={status === 'hidden' ? null : status}
      onChange={onStatus}
      tiles={[
        {
          id: 'average',
          label: t.average,
          value: stats.average === null ? '0' : stats.average.toFixed(1),
        },
        {
          id: 'published',
          label: t.published,
          value: formatNumber(stats.published),
          filter: 'published',
        },
        { id: 'waiting', label: t.waiting, value: formatNumber(stats.pending), filter: 'pending' },
        { id: 'photos', label: t.photos, value: formatNumber(stats.withPhotos) },
      ]}
    />
  )
}
