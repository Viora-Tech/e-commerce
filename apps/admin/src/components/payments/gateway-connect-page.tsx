'use client'

import { CreditCard } from '@commerce/ui/icons'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import { gatewayGuides } from '@/data/payments-setup'
import { api } from '@/lib/api-client'
import GatewayConnectForm from './gateway-connect-form'
import HelpFooter from './help-footer'
import type { GatewayId, PaymentsSetup } from './types'

type GatewayConnectPageProps = {
  providerId: GatewayId
}

/** A payment app's Connect page (`/apps/<id>/connect`): the guided connect, then back to Payments. */
export default function GatewayConnectPage({ providerId }: GatewayConnectPageProps) {
  // Hooks
  const router = useRouter()
  const [setup, setSetup] = useState<PaymentsSetup | null>(null)

  useEffect(() => {
    api.payments.setup().then(setSetup)
  }, [])

  // Event handlers
  const handleConnected = () => router.push('/settings/payments')

  // Render logic
  const guide = gatewayGuides[providerId]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Connect ${guide.name}`}
        subtitle={guide.intro}
        icon={<CreditCard aria-hidden="true" />}
      />
      <Card size="form">
        <CardContent>
          {setup ? (
            <GatewayConnectForm
              providerId={providerId}
              setup={setup}
              onConnected={handleConnected}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
        </CardContent>
      </Card>
      <HelpFooter />
    </div>
  )
}
