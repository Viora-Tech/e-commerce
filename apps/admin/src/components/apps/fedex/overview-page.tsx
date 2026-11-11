'use client'

import { FEDEX_CAPABILITIES } from '@commerce/shipping-fedex/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import ProviderOverviewPage from '@/components/apps/shared/provider-overview-page'
import { fedexAppContent } from '@/data/fedex'
import { useCopy } from '@/hooks/use-copy'

/** `/apps/fedex`: status, what the connector can do, and a way into the Shipments workspace. */
export default function OverviewPage() {
  // Hooks
  const { overview: copy } = useCopy(fedexAppContent)

  // Helpers
  const connectedBody = () => (
    <CourierShipmentsLink help={copy.goToShipmentsHelp} cta={copy.goToShipments} />
  )

  // Render logic
  const lists = [
    {
      heading: copy.capabilitiesHeading,
      items: FEDEX_CAPABILITIES.map((cap) => copy.capabilities[cap] ?? cap),
    },
    { heading: copy.notYetSupported, items: copy.notYetSupportedItems, unavailable: true },
  ]

  return (
    <ProviderOverviewPage
      providerId="fedex"
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={copy}
      connectedBody={connectedBody}
      lists={lists}
    />
  )
}
