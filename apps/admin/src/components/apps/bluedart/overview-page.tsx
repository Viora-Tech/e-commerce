'use client'

import { BLUEDART_CAPABILITIES } from '@commerce/shipping-bluedart/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { bluedartAppContent } from '@/data/bluedart'
import { useCopy } from '@/hooks/use-copy'

/** `/apps/bluedart`: status, what the connector can do today, and a way into the shared Shipments workspace. */
export default function OverviewPage() {
  // Hooks
  const { overview: copy } = useCopy(bluedartAppContent)

  // Helpers
  const connectedBody = () => (
    <CourierShipmentsLink help={copy.goToShipmentsHelp} cta={copy.goToShipments} />
  )

  // Render logic
  const lists: OverviewList[] = [
    {
      heading: copy.capabilitiesHeading,
      items: BLUEDART_CAPABILITIES.map((cap) => copy.capabilities[cap] ?? cap),
    },
    { heading: copy.notYetSupported, items: copy.notYetSupportedItems },
  ]

  return (
    <ProviderOverviewPage
      providerId="bluedart"
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={copy}
      connectedBody={connectedBody}
      lists={lists}
    />
  )
}
