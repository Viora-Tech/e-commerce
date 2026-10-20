'use client'

import { DHL_EXPRESS_CAPABILITIES } from '@commerce/shipping-dhl-express/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import ProviderOverviewPage from '@/components/apps/shared/provider-overview-page'
import { dhlExpressAppContent } from '@/data/dhl-express'
import { useCopy } from '@/hooks/use-copy'

/** `/apps/dhl-express`: status, what the connector can do, and a way into the Shipments workspace. */
export default function OverviewPage() {
  // Hooks
  const copy = useCopy(dhlExpressAppContent).overview

  // Helpers
  const connectedBody = () => (
    <CourierShipmentsLink help={copy.goToShipmentsHelp} cta={copy.goToShipments} />
  )

  // Render logic
  const lists = [
    {
      heading: copy.capabilitiesHeading,
      items: DHL_EXPRESS_CAPABILITIES.map((cap) => copy.capabilities[cap] ?? cap),
    },
    { heading: copy.notYetSupported, items: copy.notYetSupportedItems },
  ]

  return (
    <ProviderOverviewPage
      providerId="dhl-express"
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={copy}
      connectedBody={connectedBody}
      lists={lists}
    />
  )
}
