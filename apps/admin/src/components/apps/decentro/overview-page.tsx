'use client'

import { CreditCard } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import PaymentModeBadge from '@/components/payments/payment-mode-badge'
import TestModeBar from '@/components/payments/test-mode-bar'
import { decentroAppContent as appCopy } from '@/data/decentro'
import { routes } from '@/lib/routes'

const copy = appCopy.overview

const lists: OverviewList[] = [
  { heading: copy.capabilitiesHeading, items: copy.capabilities, bulleted: true },
  { heading: copy.limitsHeading, items: copy.limits, bulleted: true },
]

/** Enabled is not enough: the keys must be saved too. */
const isConnected = (saved: FieldValues) => !!saved.clientId

const modeOf = (saved: FieldValues) => (saved.mode === 'live' ? 'live' : 'test')

const modeBadge = (saved: FieldValues) => <PaymentModeBadge mode={modeOf(saved)} />

const connectedBody = (saved: FieldValues) => (
  <div className="flex flex-col gap-3">
    {modeOf(saved) === 'test' ? <TestModeBar variant="card" /> : null}
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        className="w-fit"
        render={<Link href={routes.apps.connect('decentro')} />}
        nativeButton={false}
      >
        {copy.manage}
      </Button>
      <Button
        variant="outline"
        className="w-fit"
        render={<Link href={routes.settings.payments()} />}
        nativeButton={false}
      >
        {copy.paymentsCta}
      </Button>
    </div>
  </div>
)

/** `/apps/decentro`: connection status, what Decentro does for the store, and its limits. */
export default function OverviewPage() {
  return (
    <ProviderOverviewPage
      providerId="decentro"
      kind="payments"
      icon={<CreditCard aria-hidden="true" />}
      copy={copy}
      isConnected={isConnected}
      badges={modeBadge}
      connectedBody={connectedBody}
      lists={lists}
    />
  )
}
