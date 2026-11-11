'use client'

import { DTDC_CAPABILITIES } from '@commerce/shipping-dtdc/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { dtdcAppContent } from '@/data/dtdc'
import { useCopy } from '@/hooks/use-copy'

/** `/apps/dtdc`: status, what the connector can do today, and a way into the shared Shipments workspace. */
export default function OverviewPage() {
  // Hooks
  const { overview: copy } = useCopy(dtdcAppContent)

  // Helpers
  const connectedBody = () => (
    <CourierShipmentsLink help={copy.goToShipmentsHelp} cta={copy.goToShipments} />
  )

  // Render logic
  const lists: OverviewList[] = [
    {
      heading: copy.capabilitiesHeading,
      items: DTDC_CAPABILITIES.map((cap) => copy.capabilities[cap] ?? cap),
    },
    { heading: copy.notYetSupported, items: copy.notYetSupportedItems, unavailable: true },
  ]

  return (
    <ProviderOverviewPage
      providerId="dtdc"
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={copy}
      connectedBody={connectedBody}
      lists={lists}
    />
  )
}
