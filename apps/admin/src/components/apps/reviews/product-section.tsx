'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ProductSectionProps } from '@/apps/product-sections'
import OrderChip from '@/components/orders/order-chip'
import { productPageContent } from '@/data/product-page'
import { reviewToolsContent } from '@/data/review-tools'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ReviewStars from './review-stars'

type Page = Awaited<ReturnType<typeof api.reviews.list>>

const LATEST = 3

/** The Reviews app on a product's More tab: how many reviews it has and the latest few. */
export default function ProductSection({ productId }: ProductSectionProps) {
  // Hooks
  const copy = useCopy(productPageContent)
  const reviewsCopy = useCopy(reviewsContent)
  const { qr: qrCopy } = useCopy(reviewToolsContent)
  const [page, setPage] = useState<Page | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.reviews
      .list({ productId, perPage: LATEST })
      .then((p) => !cancelled && setPage(p))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [productId])

  // Early returns
  if (failed) return <p className="text-body text-muted-foreground">{copy.apps.failed}</p>
  if (!page) return null

  // Render logic
  const href = `${routes.apps.page('reviews')}?product=${encodeURIComponent(productId)}`

  return (
    <div className="flex flex-col gap-3">
      {page.total === 0 ? (
        <p className="text-body text-muted-foreground">{copy.reviews.empty}</p>
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
                <OrderChip kind="review" value={r.status} />
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
