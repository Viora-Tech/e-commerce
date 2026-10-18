'use client'

import { siteConfig } from '@commerce/config/site'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AppLogo from '@/components/apps/app-logo'
import PageHeader from '@/components/layout/page-header'
import { appsContent } from '@/data/apps'
import { gatewayGuides, PAYMENTS_PAGE_HREF, paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import GatewayConnectForm from './gateway-connect-form'
import type { GatewayId, PaymentsSetup } from './types'

type GatewayConnectPageProps = {
  providerId: GatewayId
}

/** A payment app's Connect page (`/apps/<id>/connect`): the guided connect, then back to Payments. */
export default function GatewayConnectPage({ providerId }: GatewayConnectPageProps) {
  // Hooks
  const copy = useCopy(paymentsSetupContent)
  const guides = useCopy(gatewayGuides)
  const apps = useCopy(appsContent)
  const router = useRouter()
  const [setup, setSetup] = useState<PaymentsSetup | null>(null)

  useEffect(() => {
    api.payments.setup().then(setSetup)
  }, [])

  // Event handlers
  const handleConnected = () => router.push(routes.settings.payments())

  // Render logic
  const guide = guides[providerId]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.wizard.connect.title(guide.name)}
        subtitle={guide.intro}
        back={{ label: copy.backToPayments, href: PAYMENTS_PAGE_HREF }}
        lead={{ kind: 'logo', node: <AppLogo id={providerId} icon={null} size={48} /> }}
        actions={
          <Button
            variant="ghost"
            nativeButton={false}
            render={<a href={siteConfig.urls.docs} target="_blank" rel="noreferrer" />}
          >
            {apps.viewGuide}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </Button>
        }
      />
      {setup ? (
        <GatewayConnectForm
          providerId={providerId}
          setup={setup}
          onConnected={handleConnected}
          twoColumn
        />
      ) : (
        <Card gap={4} inset={6}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      )}
    </div>
  )
}
