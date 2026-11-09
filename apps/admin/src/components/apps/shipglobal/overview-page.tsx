'use client'

import { SHIPGLOBAL_CAPABILITIES } from '@commerce/shipping-shipglobal/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { shipglobalAppContent } from '@/data/shipglobal'
import { useCopy } from '@/hooks/use-copy'

/** `/apps/shipglobal`: status and what the app can do. Tracking comes from ShipGlobal's API, so
 *  parcels move along on their own in the Shipments workspace. */
export default function OverviewPage() {
  // Hooks
  const copy = useCopy(shipglobalAppContent)

  // Helpers
  const connectedBody = () => (
    <CourierShipmentsLink
      help={copy.overview.goToShipmentsHelp}
      cta={copy.overview.goToShipments}
    />
  )

  // Render logic
  const lists: OverviewList[] = [
    {
      heading: copy.overview.capabilitiesHeading,
      items: SHIPGLOBAL_CAPABILITIES.map((cap) => copy.overview.capabilities[cap] ?? cap),
    },
    { heading: copy.overview.notYetSupported, items: copy.overview.notYetSupportedItems },
  ]

  return (
    <ProviderOverviewPage
      providerId="shipglobal"
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={copy.overview}
      connectedBody={connectedBody}
      lists={lists}
    />
  )
}
