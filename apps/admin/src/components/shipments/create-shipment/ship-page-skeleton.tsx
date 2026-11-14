'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'

/* The route card's two sides (Ship from, Ship to). */
const SIDES = ['from', 'to'] as const

/**
 * Create shipment while the order loads (`orders/[id]/ship/loading.tsx` and the page itself
 * until the draft arrives): the real title with the back link and Ship it yourself, the route
 * card's three bands, the Package card and the Summary card on the right. The same frame and
 * cards as the loaded page, so nothing moves when it fills in (audit section 7 row 6).
 */
export default function ShipPageSkeleton() {
  // Hooks
  const copy = useCopy(createShipmentContent)

  // Render logic
  const route = (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-busy="true"
      aria-label={copy.page.title}
    >
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-28" />
        <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border">
        {SIDES.map((s) => (
          <div key={s} className="flex flex-col gap-2 p-4">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        ))}
      </div>
      <div className="flex h-11 items-center border-t border-border px-4">
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
    </section>
  )

  return (
    <ProoflyDetailPage
      header={<PageHeaderSkeleton title={copy.page.title} back actions={1} />}
      main={
        <>
          {route}
          <DataCardSkeleton fields={3} />
        </>
      }
      side={<DataCardSkeleton fields={1} lines={4} />}
    />
  )
}
