'use client'

import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import InlineState from '@/components/states/inline-state'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { DraftOrder } from './flow-state'

type ShipPageUnavailableProps = {
  orderId: string
  /** Why the order can't be booked here; null when it simply failed to load. */
  blocked: DraftOrder['blocked']
  /** The order did not load: Try again reads it again (audit section 4). */
  onRetry?: (() => void) | undefined
}

/** The Create shipment page for an order that can't be booked: the reason, and a way back; or,
 *  when it simply failed to load, the error with Try again. */
export default function ShipPageUnavailable({
  orderId,
  blocked,
  onRetry,
}: ShipPageUnavailableProps) {
  // Hooks
  const content = useCopy(createShipmentContent)

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={content.page.title}
          back={{ label: content.page.backToOrder, href: routes.orders.detail(orderId) }}
        />
      }
      main={
        <DataCard title={content.page.title}>
          {onRetry && !blocked ? (
            <InlineState kind="error" heading={content.page.notFound} onRetry={onRetry} />
          ) : (
            <EmptyState
              variant="plain"
              body={blocked ? content.bulkPackage.blocked[blocked] : content.page.notFound}
            />
          )}
        </DataCard>
      }
    />
  )
}
