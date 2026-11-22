'use client'

import { RAPIDSHYP_CAPABILITIES } from '@commerce/shipping-rapidshyp/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { rapidshypAppContent } from '@/data/rapidshyp'
import { useCopy } from '@/hooks/use-copy'

/** `/apps/rapidshyp`: status, what the connector can do today, and a way into the shared Shipments workspace. */
export default function OverviewPage() {
  // Hooks
  const copy = useCopy(rapidshypAppContent.overview)

  // Derived
  const lists: OverviewList[] = [
    {
      heading: copy.capabilitiesHeading,
      items: RAPIDSHYP_CAPABILITIES.map((cap) => copy.capabilities[cap] ?? cap),
    },
    { heading: copy.notYetSupported, items: copy.notYetSupportedItems, unavailable: true },
  ]
  const connectedBody = () => (
    <CourierShipmentsLink
      courier="rapidshyp"
      help={copy.goToShipmentsHelp}
      cta={copy.goToShipments}
    />
  )

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
