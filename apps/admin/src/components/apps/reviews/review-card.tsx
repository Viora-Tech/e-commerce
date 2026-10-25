import DataCard from '@/components/layout/data-card'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import ReviewStars from './review-stars'

type Detail = Awaited<ReturnType<typeof api.reviews.get>>

type ReviewCardProps = { detail: Detail }

/** The review as the customer wrote it: stars, title, text, photos, then who, which order and when. */
export default function ReviewCard({ detail }: ReviewCardProps) {
  // Hooks
  const { detail: copy } = useCopy(reviewsContent)

  // Render logic
  const r = detail.review

  return (
    <DataCard title={copy.review}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ReviewStars value={r.rating} label={copy.outOf(r.rating)} size="md" />
          <span className="text-caption text-muted-foreground">{copy.outOf(r.rating)}</span>
        </div>
        {r.title ? <h2 className="text-card-title text-ink-strong">{r.title}</h2> : null}
        <p className="max-w-prose text-body whitespace-pre-wrap">{r.body}</p>
        {detail.photos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {detail.photos.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="block size-20 overflow-hidden rounded-md border border-border bg-muted"
              >
                {/* biome-ignore lint/performance/noImgElement: customer photos from the store's own storage. */}
                <img src={p.url} alt="" className="size-full object-cover" />
              </a>
            ))}
          </div>
        ) : null}
        {detail.photosWaiting > 0 ? (
          <p className="text-caption text-muted-foreground">
            {copy.photosWaiting(detail.photosWaiting)}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
          {r.verifiedBuyer ? (
            <StatusChip tone="success">{copy.verified}</StatusChip>
          ) : (
            <span>{copy.notVerified}</span>
          )}
          {r.orderNumber ? <span>{copy.order(r.orderNumber)}</span> : null}
          <span>
            {copy.posted} <RelativeTime value={r.createdAt} />
          </span>
          <span>{copy.source[r.source]}</span>
          {r.helpfulCount > 0 ? <span>{copy.helpful(r.helpfulCount)}</span> : null}
        </p>
      </div>
    </DataCard>
  )
}
