'use client'

import type { AppPageProps } from '@/apps/registry'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import { reviewToolsContent } from '@/data/review-tools'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ReviewQrCard from './review-qr-card'

type Cards = Awaited<ReturnType<typeof api.reviews.qrLinks>>

/**
 * Review QR cards (`/apps/reviews/qr/order-<id>` from an order's More actions, or
 * `qr/product-<id>` from a product's Reviews card): one printable card per product.
 */
export default function QrPage({ params }: AppPageProps) {
  // Hooks
  const { qr: copy } = useCopy(reviewToolsContent)
  const { data: cards, failed } = useLoad<Cards>(
    () => api.reviews.qrLinks({ target: params.target ?? '' }),
    [params.target],
  )

  // Render logic
  const empty = failed || (cards !== null && cards.links.length === 0)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        subtitle={cards ? copy.subtitle(cards.orderNumber) : undefined}
        back={{ label: copy.back, href: routes.apps.page('reviews') }}
      />
      {empty ? (
        <EmptyState variant="inline" body={copy.empty} />
      ) : !cards ? (
        <DataCardSkeleton fields={0} lines={8} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.links.map((l) => (
              <ReviewQrCard
                key={l.productId}
                title={l.title}
                url={l.url}
                storeName={cards.storeName}
              />
            ))}
          </div>
          {cards.orderNumber !== null && (
            <p className="text-caption text-muted-foreground">{copy.expires}</p>
          )}
        </>
      )}
    </div>
  )
}
