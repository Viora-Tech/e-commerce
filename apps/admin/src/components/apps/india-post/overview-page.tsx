'use client'

import {
  INDIA_POST_CAPABILITIES,
  INDIA_POST_TRACKING_PAGE,
} from '@commerce/shipping-indiapost/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import ManualParcelsCard from '@/components/apps/shared/manual-parcels-card'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { indiaPostAppContent } from '@/data/india-post'
import { useCopy } from '@/hooks/use-copy'

/** `/apps/india-post`: status, what the app can do, and the parcels on the way with their status
 *  (India Post sends no tracking, so the merchant moves each one along here). */
export default function OverviewPage() {
  // Hooks
  const copy = useCopy(indiaPostAppContent)

  // Render logic
  const lists: OverviewList[] = [
    {
      heading: copy.overview.capabilitiesHeading,
      items: INDIA_POST_CAPABILITIES.map((cap) => copy.overview.capabilities[cap] ?? cap),
    },
    { heading: copy.overview.notYetSupported, items: copy.overview.notYetSupportedItems },
  ]

  return (
    <ProviderOverviewPage
      providerId="india-post"
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={copy.overview}
      connectedBody={() => (
        <CourierShipmentsLink
          help={copy.overview.goToShipmentsHelp}
          cta={copy.overview.goToShipments}
        />
      )}
      lists={lists}
      footer={
        <ManualParcelsCard
          providerId="india-post"
          copy={copy.parcels}
          trackingPage={INDIA_POST_TRACKING_PAGE}
        />
      }
    />
  )
}
