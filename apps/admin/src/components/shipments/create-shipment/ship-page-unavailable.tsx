'use client'

import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { DraftOrder } from './flow-state'

type ShipPageUnavailableProps = {
  orderId: string
  /** Why the order can't be booked here; null when it simply failed to load. */
  blocked: DraftOrder['blocked']
}

/** The Create shipment page for an order that can't be booked: the reason, and a way back. */
export default function ShipPageUnavailable({ orderId, blocked }: ShipPageUnavailableProps) {
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
          <EmptyState
            variant="plain"
            body={blocked ? content.bulkPackage.blocked[blocked] : content.page.notFound}
          />
        </DataCard>
      }
    />
  )
}
