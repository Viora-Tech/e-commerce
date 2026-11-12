/**
 * The `/theme-actions/<name>` endpoints the buy box island on a Hono product page calls in place
 * of Next's server actions (`./actions.ts` on the server, `apps/storefront-hono/src/island/actions.ts`
 * in the browser). No imports: the island's browser bundle reads it.
 */
export const ISLAND_ACTIONS = {
  /** `addLineAction(variantId, quantity)`. */
  add: 'island-add',
  /** `estimateDeliveryAction(pincode)`. */
  delivery: 'island-delivery',
  /** `notifyMeAction(variantId, state, form)`. */
  notify: 'island-notify',
} as const

export type IslandActionName = (typeof ISLAND_ACTIONS)[keyof typeof ISLAND_ACTIONS]
