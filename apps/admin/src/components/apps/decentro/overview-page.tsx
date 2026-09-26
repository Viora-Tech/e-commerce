'use client'

import { CircleCheck, CreditCard } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import { decentroAppContent as appCopy } from '@/data/decentro'
import { api } from '@/lib/api-client'

type Status = { connected: boolean; mode: 'test' | 'live' }

const copy = appCopy.overview

const TESTED_FLAG_KEY = 'decentro-connect-tested'

/** Set by the Connect page after a passing "Test connection"; cosmetic only. */
function readTestedFlag(): boolean {
  try {
    return localStorage.getItem(TESTED_FLAG_KEY) === 'true'
  } catch {
    return false
  }
}

/** Connection status, what Decentro does for the store, and its limits. */
export default function OverviewPage() {
  // Hooks
  const [status, setStatus] = useState<Status | null>(null)
  const [tested, setTested] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.store.getPayments().then((r) => {
      const saved = r.settings.providers.decentro ?? {}
      if (cancelled) return
      setStatus({
        connected: r.settings.enabled.includes('decentro') && !!saved.clientId,
        mode: saved.mode === 'live' ? 'live' : 'test',
      })
    })
    setTested(readTestedFlag())
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <DataCard title={copy.title} icon={<CreditCard aria-hidden="true" />}>
        {status === null ? null : status.connected ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="w-fit gap-1 text-success">
                <CircleCheck aria-hidden="true" className="size-3.5" />
                {tested ? copy.connectedAndTested : copy.connected}
              </Badge>
              <Badge variant="outline" className="w-fit">
                {copy.mode[status.mode]}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="w-fit"
                render={<Link href="/apps/decentro/connect" />}
                nativeButton={false}
              >
                {copy.manage}
              </Button>
              <Button
                variant="outline"
                className="w-fit"
                render={<Link href="/settings/payments" />}
                nativeButton={false}
              >
                {copy.paymentsCta}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-body text-muted-foreground">{copy.notConnected}</p>
            <Button
              className="w-fit"
              render={<Link href="/apps/decentro/connect" />}
              nativeButton={false}
            >
              {copy.connectCta}
            </Button>
          </div>
        )}
      </DataCard>

      <DataCard title={copy.capabilitiesHeading}>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {copy.capabilities.map((c) => (
            <li key={c} className="text-body text-muted-foreground">
              {c}
            </li>
          ))}
        </ul>
      </DataCard>

      <DataCard title={copy.limitsHeading}>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {copy.limits.map((c) => (
            <li key={c} className="text-body text-muted-foreground">
              {c}
            </li>
          ))}
        </ul>
      </DataCard>
    </div>
  )
}
