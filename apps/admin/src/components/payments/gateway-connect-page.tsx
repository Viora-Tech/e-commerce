'use client'

import { siteConfig } from '@commerce/config/site'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AppLogo from '@/components/apps/app-logo'
import PageHeader from '@/components/layout/page-header'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import LoadFailed from '@/components/states/load-failed'
import { appsContent } from '@/data/apps'
import { gatewayGuides, PAYMENTS_PAGE_HREF, paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import GatewayConnectForm from './gateway-connect-form'
import GatewayFeeCard from './gateway-fee-card'
import TestModeBar from './test-mode-bar'
import type { GatewayId, PaymentsSetup } from './types'

type GatewayConnectPageProps = {
  providerId: GatewayId
}

/**
 * A payment app's Connect page (`/apps/<id>/connect`): the guided connect, then back to
 * Payments, and the extra charge (or discount) for paying with that gateway.
 */
export default function GatewayConnectPage({ providerId }: GatewayConnectPageProps) {
  // Hooks
  const copy = useCopy(paymentsSetupContent)
  const guides = useCopy(gatewayGuides)
  const apps = useCopy(appsContent)
  const router = useRouter()
  const [setup, setSetup] = useState<PaymentsSetup | null>(null)

  const { failed, retry } = useLoad(async () => {
    const next = await api.payments.setup()
    setSetup(next)
    return next
  })

  // Event handlers
  const handleConnected = () => router.push(routes.settings.payments())

  // Render logic
  const guide = guides[providerId]
  const testMode = setup?.gateways.find((g) => g.id === providerId)?.mode === 'test'

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
      {testMode ? <TestModeBar /> : null}
      {setup ? (
        <GatewayConnectForm
          providerId={providerId}
          setup={setup}
          onConnected={handleConnected}
          twoColumn
        />
      ) : failed ? (
        <LoadFailed failed={failed} onRetry={retry} size="inline" />
      ) : (
        <SectionPageSkeleton header={false} cards={1} />
      )}
      {setup ? <GatewayFeeCard providerId={providerId} name={guide.name} /> : null}
    </div>
  )
}
