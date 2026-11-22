'use client'

import { SHIPROCKET_CAPABILITIES } from '@commerce/shipping-shiprocket/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import CourierWebhookCard from '@/components/apps/shared/courier-webhook-card'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { shiprocketAppContent } from '@/data/shiprocket'
import { useCopy } from '@/hooks/use-copy'

/** `/apps/shiprocket`: status, what the connector can do today, and a way into the shared Shipments workspace. */
export default function OverviewPage() {
  // Hooks
  const copy = useCopy(shiprocketAppContent.overview)

  // Derived
  const lists: OverviewList[] = [
    {
      heading: copy.capabilitiesHeading,
      items: SHIPROCKET_CAPABILITIES.map((cap) => copy.capabilities[cap] ?? cap),
    },
  ]
  const connectedBody = () => (
    <CourierShipmentsLink
      courier="shiprocket"
      help={copy.goToShipmentsHelp}
      cta={copy.goToShipments}
    />
  )

  return (
    <ProviderOverviewPage
      providerId="shiprocket"
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={copy}
      connectedBody={connectedBody}
      lists={lists}
      footer={
        <CourierWebhookCard
          providerId="shiprocket"
          title={copy.webhookUrlLabel}
          where={copy.webhookWhere}
          help={copy.webhookUrlHelp}
        />
      }
    />
  )
}
