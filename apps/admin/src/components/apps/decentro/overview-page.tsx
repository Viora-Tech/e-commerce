'use client'

import { CreditCard } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { decentroAppContent as appCopy } from '@/data/decentro'
import { routes } from '@/lib/routes'

const copy = appCopy.overview

const lists: OverviewList[] = [
  { heading: copy.capabilitiesHeading, items: copy.capabilities, bulleted: true },
  { heading: copy.limitsHeading, items: copy.limits, bulleted: true },
]

/** Enabled is not enough: the keys must be saved too. */
const isConnected = (saved: FieldValues) => !!saved.clientId

const modeBadge = (saved: FieldValues) => (
  <Badge variant="outline" className="w-fit">
    {copy.mode[saved.mode === 'live' ? 'live' : 'test']}
  </Badge>
)

const connectedBody = () => (
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
