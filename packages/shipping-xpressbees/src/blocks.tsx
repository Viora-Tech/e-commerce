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
 * Xpressbees's storefront block: the PIN-code delivery checker, for a merchant who wants it
 * somewhere other than under the buy box. The estimate comes from the store's active shipping
 * provider via the `estimate` action the product page binds into
 * `appBlockContext.deliveryChecker`; this block does not call Xpressbees directly. Every courier app
 * lists the same block under its own namespace; a merchant only needs one. See docs/plugins.md.
 */
export const deliveryCheckerBlocks: AppBlockDefinition[] = [
  {
    type: 'xpressbees/DeliveryChecker',
    label: 'Delivery checker',
    description: 'PIN code lookup that shows "Delivery by <date>".',
    icon: 'Truck',
    fields: {},
    defaultProps: {},
    render: render as unknown as AppBlockDefinition['render'],
  },
]

export type { DeliveryEstimateResult }
