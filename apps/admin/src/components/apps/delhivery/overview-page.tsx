'use client'

import { DELHIVERY_CAPABILITIES } from '@commerce/shipping-delhivery/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import CourierWebhookCard from '@/components/apps/shared/courier-webhook-card'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { delhiveryAppContent as appCopy } from '@/data/delhivery'

const copy = appCopy.overview

const lists: OverviewList[] = [
  {
    heading: copy.capabilitiesHeading,
    items: DELHIVERY_CAPABILITIES.map((cap) => copy.capabilities[cap] ?? cap),
    // Delhivery has no manifest or wallet API; the app covers both another way.
    notAvailable: [copy.capabilities.manifest ?? '', copy.capabilities.wallet ?? ''],
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
      footer={
        <CourierWebhookCard
          providerId="delhivery"
          title={copy.webhookUrlLabel}
          where={copy.webhookWhere}
          help={copy.webhookUrlHelp}
        />
      }
    />
  )
}
