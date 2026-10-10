import RelativeTime from '@/components/layout/relative-time'
import ProductThumb from '@/components/products/product-thumb'
import StatusLabel from '@/components/status/status-label'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { reviewsContent } from '@/data/reviews'
import type { api } from '@/lib/api-client'
import ReviewStars from './review-stars'

export type ReviewRow = Awaited<ReturnType<typeof api.reviews.list>>['rows'][number]

/** Columns of the reviews list, after the approved design (Apps, Reviews 18:2). */
export function reviewColumns(copy: typeof reviewsContent): ResourceColumnSpec<ReviewRow>[] {
  const c = copy.list
  return [
    {
      id: 'product',
      title: c.columns.product,
      hideable: false,
      align: 'start',
      className: 'w-60 px-3 whitespace-normal',
      sortValue: (r) => r.productTitle,
      render: (r) => (
        <span className="flex items-center gap-3 text-left">
          <ProductThumb url={r.productImage} />
          <span className="line-clamp-2 text-body">{r.productTitle}</span>
        </span>
      ),
    },
    {
      id: 'rating',
      title: c.columns.rating,
      className: 'w-28',
      sortValue: (r) => r.rating,
      render: (r) => <ReviewStars value={r.rating} label={copy.stars(r.rating)} />,
    },
    {
      id: 'review',
      title: c.columns.review,
      align: 'start',
      className: 'w-96 whitespace-normal',
      render: (r) => (
        <span className="flex min-w-0 flex-col text-left">
          <span className="flex items-center gap-2">
            <span className="truncate text-body-strong">{r.title || c.noTitle}</span>
            {r.hasPhotos ? (
              <span className="inline-flex h-5 shrink-0 items-center rounded-sm bg-info-soft px-1.5 text-caption text-info">
                {c.photo}
              </span>
            ) : null}
          </span>
          <span className="truncate text-caption text-muted-foreground">{r.body}</span>
        </span>
      ),
    },
    {
      id: 'customer',
      title: c.columns.customer,
      align: 'start',
      className: 'w-40',
      sortValue: (r) => r.reviewerName,
      render: (r) => (
        <span className="flex flex-col text-left">
          <span className="truncate text-body">{r.reviewerName}</span>
          {r.verifiedBuyer ? (
            <span className="text-caption text-success">{c.verified}</span>
          ) : r.source === 'judgeme' ? (
            <span className="text-caption text-muted-foreground">{c.imported}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'date',
      title: c.columns.date,
      className: 'w-32',
      sortValue: (r) => new Date(r.createdAt).getTime(),
      render: (r) => <RelativeTime value={r.createdAt} />,
    },
    {
      id: 'status',
      title: c.columns.status,
      className: 'w-28',
      sortValue: (r) => r.status,
      render: (r) => <StatusLabel kind="review" value={r.status} variant="pill" size="sm" />,
    },
  ]
}
