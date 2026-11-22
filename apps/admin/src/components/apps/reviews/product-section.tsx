'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import type { ProductSectionProps } from '@/apps/product-sections'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import EmptyState from '@/components/layout/empty-state'
import StatusLabel from '@/components/status/status-label'
import { appsContent } from '@/data/apps'
import { productPageContent } from '@/data/product-page'
import { reviewToolsContent } from '@/data/review-tools'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ProductSummary from './product-summary'
import ReviewStars from './review-stars'

type Page = Awaited<ReturnType<typeof api.reviews.list>>

const LATEST = 3

/** The Reviews app on a product's More tab: how many reviews it has and the latest few. */
export default function ProductSection({ productId }: ProductSectionProps) {
  // Hooks
  const apps = useCopy(appsContent)
  const copy = useCopy(productPageContent)
  const reviewsCopy = useCopy(reviewsContent)
  const { qr: qrCopy } = useCopy(reviewToolsContent)
  /** Skeleton lines while it loads; "Could not load the reviews" with Try again when it fails. */
  const {
    data: page,
    failed,
    retry,
  } = useLoad<Page>(() => api.reviews.list({ productId, perPage: LATEST }), [productId])

  // Early returns
  if (failed) {
    return <LoadFailedState heading={apps.couldNotLoad.reviews} failed={failed} onRetry={retry} />
  }
  if (!page) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    )
  }

  // Render logic
  const href = `${routes.apps.page('reviews')}?product=${encodeURIComponent(productId)}`

  return (
    <div className="flex flex-col gap-3">
      <ProductSummary productId={productId} />
      {page.total === 0 ? (
        <EmptyState variant="inline" body={copy.reviews.empty} />
      ) : (
        <>
          <p className="text-body-strong">{copy.reviews.count(page.total)}</p>
          <ul className="flex flex-col divide-y divide-border">
            {page.rows.map((r) => (
              <li key={r.id} className="flex min-w-0 items-start gap-3 py-2 first:pt-0">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <ReviewStars value={r.rating} label={reviewsCopy.stars(r.rating)} />
                  <Link
                    href={routes.apps.page('reviews', 'reviews', r.id)}
                    className="truncate text-body font-medium hover:underline"
                  >
                    {r.title || r.body || copy.reviews.anonymous}
                  </Link>
                  <span className="truncate text-caption text-muted-foreground">
                    {r.reviewerName || copy.reviews.anonymous}
                  </span>
                </div>
                <StatusLabel kind="review" value={r.status} variant="soft" />
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap gap-4">
        <Link href={href} className="text-body font-medium text-link hover:underline">
          {copy.reviews.viewAll}
        </Link>
        <Link
          href={routes.apps.page('reviews', 'qr', `product-${productId}`)}
          className="text-body font-medium text-link hover:underline"
        >
          {qrCopy.open}
        </Link>
      </div>
    </div>
  )
}
