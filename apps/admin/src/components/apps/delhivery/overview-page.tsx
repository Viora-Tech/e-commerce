'use client'

import { DELHIVERY_CAPABILITIES } from '@commerce/shipping-delhivery'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { delhiveryAppContent as appCopy } from '@/data/delhivery'

const copy = appCopy.overview

const lists: OverviewList[] = [
  {
    heading: copy.capabilitiesHeading,
    items: DELHIVERY_CAPABILITIES.map((cap) => copy.capabilities[cap] ?? cap),
  },
]

const connectedBody = () => (
  <CourierShipmentsLink help={copy.goToShipmentsHelp} cta={copy.goToShipments} />
)

/** `/apps/delhivery`: status, what the connector can do today, and a way into the shared Shipments workspace. */
export default function OverviewPage() {
  return (
    <ProviderOverviewPage
      providerId="delhivery"
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={copy}
      connectedBody={connectedBody}
      lists={lists}
    />
  )
}
