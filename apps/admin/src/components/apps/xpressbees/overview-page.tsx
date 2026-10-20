'use client'

import { XPRESSBEES_CAPABILITIES } from '@commerce/shipping-xpressbees/client'
import { Truck } from '@commerce/ui/icons'
import CourierShipmentsLink from '@/components/apps/shared/courier-shipments-link'
import CourierWebhookCard from '@/components/apps/shared/courier-webhook-card'
import ProviderOverviewPage, {
  type OverviewList,
} from '@/components/apps/shared/provider-overview-page'
import { xpressbeesAppContent } from '@/data/xpressbees'
import { useCopy } from '@/hooks/use-copy'

const PROVIDER_ID = 'xpressbees'

/** `/apps/xpressbees`: status, what the connector can do today, the tracking webhook address,
 *  and a way into the shared Shipments workspace. */
export default function OverviewPage() {
  // Hooks
  const { overview: copy } = useCopy(xpressbeesAppContent)

  // Helpers
  const connectedBody = () => (
    <CourierShipmentsLink help={copy.goToShipmentsHelp} cta={copy.goToShipments} />
  )

  // Render logic
  const lists: OverviewList[] = [
    {
      heading: copy.capabilitiesHeading,
      items: XPRESSBEES_CAPABILITIES.map((cap) => copy.capabilities[cap] ?? cap),
    },
    { heading: copy.notYetSupported, items: copy.notYetSupportedItems },
  ]

  return (
    <ProviderOverviewPage
      providerId={PROVIDER_ID}
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={copy}
      connectedBody={connectedBody}
      lists={lists}
      footer={
        <CourierWebhookCard
          providerId={PROVIDER_ID}
          title={copy.webhookUrlLabel}
          where={copy.webhookWhere}
          help={copy.webhookUrlHelp}
        />
      }
    />
  )
}
