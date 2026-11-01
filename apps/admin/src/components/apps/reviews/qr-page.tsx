'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import type { AppPageProps } from '@/apps/registry'
import PageHeader from '@/components/layout/page-header'
import { reviewToolsContent } from '@/data/review-tools'
import { useCopy } from '@/hooks/use-copy'
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
  const [cards, setCards] = useState<Cards | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    api.reviews
      .qrLinks({ target: params.target ?? '' })
      .then((c) => live && setCards(c))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [params.target])

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
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      ) : !cards ? (
        <Skeleton className="h-96 w-full rounded-lg" />
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
