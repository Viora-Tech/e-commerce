'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import BackLink from '@/components/layout/back-link'
import {
  gatewayCatalogue,
  gatewayGuides,
  PAYMENTS_PAGE_HREF,
  paymentsSetupContent,
} from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import MainGatewayCard from './main-gateway-card'
import type { GatewayId, PaymentsSetup } from './types'

type GatewayOverviewPageProps = {
  providerId: GatewayId
}

/** A payment app's Overview: its health when it is the main way to get paid, else how to connect it. */
export default function GatewayOverviewPage({ providerId }: GatewayOverviewPageProps) {
  // Hooks
  const copy = useCopy(paymentsSetupContent)
  const catalogue = useCopy(gatewayCatalogue)
  const guides = useCopy(gatewayGuides)
  const [setup, setSetup] = useState<PaymentsSetup | null>(null)

  useEffect(() => {
    api.payments.setup().then(setSetup)
  }, [])

  // Helpers
  const reload = async () => {
    setSetup(await api.payments.setup())
  }

  // Early returns
  if (!setup) {
    return (
      <Card gap={4} inset={6}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
      </Card>
    )
  }

  // Render logic
  const isMain = setup.primary?.id === providerId
  const entry = catalogue.find((g) => g.id === providerId)
  const gateway = setup.gateways.find((g) => g.id === providerId)
  const onlineOn = setup.gateways.filter((g) => g.connected)
  const onlyOnline = onlineOn.length === 1 && onlineOn[0]?.id === providerId

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={PAYMENTS_PAGE_HREF} label={copy.backToPayments} />
      {isMain ? (
        <MainGatewayCard
          primary={setup.primary}
          gateway={gateway}
          onlyOnline={onlyOnline}
          onAdd={() => undefined}
          onChanged={reload}
          onTurnOnUpi={() => undefined}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-body font-semibold text-foreground">{guides[providerId].intro}</p>
            {entry ? <p className="text-body text-muted-foreground">{entry.fees}</p> : null}
            <Button
              className="w-fit"
              nativeButton={false}
              render={<Link href={routes.apps.connect(providerId)} />}
            >
              {copy.main.connect}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
