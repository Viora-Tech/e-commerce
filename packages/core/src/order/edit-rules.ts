/** SOURCE OF TRUTH: canTakeOver, canStaffCancel, canEditOrder, editsAfterShipping, canHoldFulfillment — WHAT: which orders staff may take over, cancel, edit and hold / WHY: the admin hides the actions and the server refuses them by the same rules; pure, so the browser can import it (`@commerce/core/order-edit-rules`) */
import { UNFULFILLED_STATUSES } from './aggregate-status'

type OrderFacts = { importedFrom: string | null; status: string; fulfillmentStatus: string }

/** Open and not (fully) packed: nothing has left yet that a cancel or an edit would contradict. */
const notShipped = (o: OrderFacts): boolean =>
  o.status === 'open' && (UNFULFILLED_STATUSES as readonly string[]).includes(o.fulfillmentStatus)

/** An imported order still waiting to go out: "Manage this order" on the Imported card. */
export function canTakeOver(o: OrderFacts): boolean {
  return o.importedFrom !== null && notShipped(o)
}

/**
 * "Cancel order": open and not shipped. An imported order that is still open can be cancelled
 * too (it is taken over first); imported history cannot.
 */
export function canStaffCancel(o: OrderFacts): boolean {
  return notShipped(o)
}

/**
 * "Edit order": worked here (an import is taken over first) and open or completed (delivered). A
 * shipped or delivered order can be edited too (owner decision after #923, #1014): what was packed
 * stays as it is (no fewer units, no new price), new items go out in a new parcel and the order
 * reopens. A cancelled order cannot.
 */
export function canEditOrder(o: OrderFacts): boolean {
  return o.importedFrom === null && (o.status === 'open' || o.status === 'completed')
}

/** Everything is packed or already on its way: an edit will not change what was sent. */
export function editsAfterShipping(o: Pick<OrderFacts, 'fulfillmentStatus'>): boolean {
  return !(UNFULFILLED_STATUSES as readonly string[]).includes(o.fulfillmentStatus)
}

/** Why staff hold an order's fulfilment (#1011); `other` leans on the note. */
export const FULFILLMENT_HOLD_REASONS = [
  'awaiting_stock',
  'address_check',
  'payment_check',
  'customer_request',
  'other',
] as const
export type FulfillmentHoldReason = (typeof FULFILLMENT_HOLD_REASONS)[number]

/** "Hold fulfilment": open, worked here, and something is still left to pack. */
export function canHoldFulfillment(o: OrderFacts): boolean {
  return o.importedFrom === null && notShipped(o)
}
