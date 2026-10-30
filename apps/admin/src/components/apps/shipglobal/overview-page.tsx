'use client'

import {
  SHIPGLOBAL_CAPABILITIES,
  SHIPGLOBAL_TRACKING_PAGE,
} from '@commerce/shipping-shipglobal/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import ManualParcelsCard from '@/components/apps/shared/manual-parcels-card'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { shipglobalAppContent } from '@/data/shipglobal'
import { useCopy } from '@/hooks/use-copy'

/** `/apps/shipglobal`: status, what the app can do, and the parcels on the way with their status
 *  (ShipGlobal's API sends no tracking, so the merchant moves each one along here). */
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
      footer={
        <ManualParcelsCard
          providerId="shipglobal"
          copy={copy.parcels}
          trackingPage={SHIPGLOBAL_TRACKING_PAGE}
        />
      }
    />
  )
}
