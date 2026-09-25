import {
  DeliveryCheckerBlock,
  type DeliveryCheckerContext,
  type DeliveryEstimateResult,
} from '@commerce/blocks'
import type { AppBlockDefinition } from '@commerce/plugins'
import { deliveryCheckerCopy as copy } from './copy'

function render(props: { puck?: { metadata?: Record<string, unknown> } }) {
  const context = (
    props.puck?.metadata?.appBlockContext as
      | { deliveryChecker?: DeliveryCheckerContext }
      | undefined
  )?.deliveryChecker
  return <DeliveryCheckerBlock context={context} copy={copy} />
}

/**
 * Delhivery's storefront block: the PIN-code delivery checker, for a
 * merchant who wants it somewhere other than under the buy box. The estimate
 * itself always comes from the store's one active shipping provider (see
 * `estimateForPincode` in apps/storefront/src/lib/shipping.ts) via the
 * `estimate` action the product page route binds into
 * `appBlockContext.deliveryChecker` — this block does not call Delhivery
 * directly. If both Delhivery and Shiprocket are installed, both apps list
 * this block (namespaced `delhivery/DeliveryChecker` and
 * `shiprocket/DeliveryChecker`); a merchant only needs to add one, since
 * either gives the same answer. See docs/plugins.md.
 */
export const deliveryCheckerBlocks: AppBlockDefinition[] = [
  {
    type: 'delhivery/DeliveryChecker',
    label: 'Delivery checker',
    description: 'PIN code lookup that shows "Delivery by <date>".',
    icon: 'Truck',
    fields: {},
    defaultProps: {},
    render: render as unknown as AppBlockDefinition['render'],
  },
]

export type { DeliveryEstimateResult }
