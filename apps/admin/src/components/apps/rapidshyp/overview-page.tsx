'use client'

import { RAPIDSHYP_CAPABILITIES } from '@commerce/shipping-rapidshyp'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { rapidshypAppContent as appCopy } from '@/data/rapidshyp'

const copy = appCopy.overview

const lists: OverviewList[] = [
  {
    heading: copy.capabilitiesHeading,
    items: RAPIDSHYP_CAPABILITIES.map((cap) => copy.capabilities[cap] ?? cap),
  },
  { heading: copy.notYetSupported, items: copy.notYetSupportedItems },
]

const connectedBody = () => (
  <CourierShipmentsLink help={copy.goToShipmentsHelp} cta={copy.goToShipments} />
)

/** `/apps/rapidshyp`: status, what the connector can do today, and a way into the shared Shipments workspace. */
export default function OverviewPage() {
  return (
    <ProviderOverviewPage
      providerId="rapidshyp"
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={copy}
      connectedBody={connectedBody}
      lists={lists}
    />
  )
}
