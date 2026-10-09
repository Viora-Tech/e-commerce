'use client'

import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SettingsPageHeader from '@/components/settings/settings-page-header'
import { gatewayGuides, paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import BackToPayments, { PAYMENTS_PAGE_HREF } from './back-to-payments'
import GatewayConnectForm from './gateway-connect-form'
import HelpFooter from './help-footer'
import type { GatewayId, PaymentsSetup } from './types'

type GatewayConnectPageProps = {
  providerId: GatewayId
}

/** A payment app's Connect page (`/apps/<id>/connect`): the guided connect, then back to Payments. */
export default function GatewayConnectPage({ providerId }: GatewayConnectPageProps) {
  // Hooks
  const copy = useCopy(paymentsSetupContent)
  const guides = useCopy(gatewayGuides)
  const router = useRouter()
  const [setup, setSetup] = useState<PaymentsSetup | null>(null)

  useEffect(() => {
    api.payments.setup().then(setSetup)
  }, [])

  // Event handlers
  const handleConnected = () => router.push('/settings/payments')

  // Render logic
  const guide = guides[providerId]

  return (
    <div className="flex flex-col gap-4">
      <BackToPayments />
      <SettingsPageHeader
        title={copy.wizard.connect.title(guide.name)}
        back={{ label: copy.title, href: PAYMENTS_PAGE_HREF }}
        subtitle={guide.intro}
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
