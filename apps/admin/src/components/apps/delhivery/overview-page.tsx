'use client'

import { DELHIVERY_CAPABILITIES } from '@commerce/shipping-delhivery'
import { CircleCheck, Truck } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import { delhiveryAppContent as appCopy } from '@/data/delhivery'
import { api } from '@/lib/api-client'

const copy = appCopy.overview

/** Status, what the connector can do today, and a way into the shared Shipments workspace. */
export default function OverviewPage() {
  // Hooks
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    api.store.getShipping().then((r) => {
      if (!cancelled) setEnabled(r.settings.enabled.includes('delhivery'))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <DataCard title={copy.title} icon={<Truck aria-hidden="true" />}>
        {enabled === null ? null : enabled ? (
          <div className="flex flex-col gap-3">
            <Badge variant="outline" className="w-fit gap-1 text-success">
              <CircleCheck aria-hidden="true" className="size-3.5" />
              {copy.connected}
            </Badge>
            <p className="text-body text-muted-foreground">{copy.goToShipmentsHelp}</p>
            <Button
              className="w-fit"
              render={<Link href="/orders/shipments" />}
              nativeButton={false}
            >
              {copy.goToShipments}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-body text-muted-foreground">{copy.notConnected}</p>
            <Button
              className="w-fit"
              render={<Link href="/apps/delhivery/connect" />}
              nativeButton={false}
            >
              {copy.connectCta}
            </Button>
          </div>
        )}
      </DataCard>

      <DataCard title={copy.capabilitiesHeading}>
        <ul className="flex flex-col gap-2">
          {DELHIVERY_CAPABILITIES.map((cap) => (
            <li key={cap} className="text-body text-muted-foreground">
              {copy.capabilities[cap] ?? cap}
            </li>
          ))}
        </ul>
      </DataCard>
    </div>
  )
}
