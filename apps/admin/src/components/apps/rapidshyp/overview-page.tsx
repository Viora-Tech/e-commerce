'use client'

import { RAPIDSHYP_CAPABILITIES } from '@commerce/shipping-rapidshyp/client'
import { CircleCheck, Truck } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import { rapidshypAppContent as appCopy } from '@/data/rapidshyp'
import { api } from '@/lib/api-client'

const copy = appCopy.overview

const TESTED_FLAG_KEY = 'rapidshyp-connect-tested'

/** Set by the Connect page after a successful "Test connection"; cosmetic only, so a blocked
 *  or private-browsing localStorage just means the badge doesn't show. */
function readTestedFlag(): boolean {
  try {
    return localStorage.getItem(TESTED_FLAG_KEY) === 'true'
  } catch {
    return false
  }
}

/** Status, what the connector can do today, and a way into the shared Shipments workspace. */
export default function OverviewPage() {
  // Hooks
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [tested, setTested] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.store.getShipping().then((r) => {
      if (!cancelled) setEnabled(r.settings.enabled.includes('rapidshyp'))
    })
    setTested(readTestedFlag())
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
              {tested ? copy.connectedAndTested : copy.connected}
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
              render={<Link href="/apps/rapidshyp/connect" />}
              nativeButton={false}
            >
              {copy.connectCta}
            </Button>
          </div>
        )}
      </DataCard>

      <DataCard title={copy.capabilitiesHeading}>
        <ul className="flex flex-col gap-2">
          {RAPIDSHYP_CAPABILITIES.map((cap) => (
            <li key={cap} className="text-body text-muted-foreground">
              {copy.capabilities[cap] ?? cap}
            </li>
          ))}
        </ul>
      </DataCard>

      <DataCard title={copy.notYetSupported}>
        <ul className="flex flex-col gap-2">
          {copy.notYetSupportedItems.map((item) => (
            <li key={item} className="text-body text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      </DataCard>
    </div>
  )
}
