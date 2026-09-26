'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  paymentsSetupContent as copy,
  gatewayCatalogue,
  gatewayGuides,
} from '@/data/payments-setup'
import { api } from '@/lib/api-client'
import MainGatewayCard from './main-gateway-card'
import type { GatewayId, PaymentsSetup } from './types'

type GatewayOverviewPageProps = {
  providerId: GatewayId
}

/** A payment app's Overview: its health when it is the main way to get paid, else how to connect it. */
export default function GatewayOverviewPage({ providerId }: GatewayOverviewPageProps) {
  // Hooks
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
      <Card className="gap-4 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
      </Card>
    )
  }

  // Render logic
  const isMain = setup.primary?.id === providerId
  const entry = gatewayCatalogue.find((g) => g.id === providerId)

  return (
    <div className="flex flex-col gap-4">
      {isMain ? (
        <MainGatewayCard
          primary={setup.primary}
          onAdd={() => undefined}
          onChanged={reload}
          onTurnOnUpi={() => undefined}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-body font-semibold text-foreground">
              {gatewayGuides[providerId].intro}
            </p>
            {entry ? (
              <p className="text-body text-muted-foreground">
                {entry.fees} {entry.settlement}
              </p>
            ) : null}
            <Button
              className="w-fit"
              nativeButton={false}
              render={<Link href={`/apps/${providerId}/connect`} />}
            >
              {copy.main.connect}
            </Button>
          </CardContent>
        </Card>
      )}
      <Button
        variant="outline"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/settings/payments" />}
      >
        {copy.title}
      </Button>
    </div>
  )
}
