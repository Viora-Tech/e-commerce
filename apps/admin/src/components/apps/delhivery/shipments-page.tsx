'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import PageHeader from '@/components/layout/page-header'
import CourierShipments from '@/components/shipments/courier-shipments'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

/** `/apps/delhivery/shipments`: the Shipments table with Delhivery's parcels only. */
export default function ShipmentsPage() {
  // Hooks
  const { shipmentsPage: copy } = useCopy(delhiveryAppContent)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.orders.shipments()} />}
          >
            {copy.openWorkspace}
          </Button>
        }
      />
      <CourierShipments provider="delhivery" providerLabel="Delhivery" />
    </div>
  )
}
