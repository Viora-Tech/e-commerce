/** SOURCE OF TRUTH: the Orders list's tabs — WHAT: which orders each tab (and Home's to-do counts) shows / WHY: one rule for the list, its counts and the dashboard */
import { UNFULFILLED_STATUSES, UNPAID_PAYMENT_STATUSES } from '@commerce/core'
import { order } from '@commerce/db'
import { and, eq, gt, inArray, isNull, ne, type SQL, sql } from 'drizzle-orm'

/** The tabs above the order list. */
export const ORDER_VIEWS = [
  'all',
  'unpaid',
  'unfulfilled',
  'pending_upi',
  'balance_due',
  'completed',
  'cancelled',
  'payment_not_finished',
] as const
export type OrderView = (typeof ORDER_VIEWS)[number]

/**
 * A storefront checkout whose online payment was never finished (the shopper closed the
 * gateway): open until the unpaid-order expiry cancels it. Shopify never makes these orders,
 * so the list keeps them out of All, Unpaid, Unfulfilled and Cancelled and gives them their
 * own tab (#849). COD and manual UPI orders are real orders and stay. Every part is non-null,
 * so `not` of it is never null.
 */
const paymentNotFinished = sql`(${order.cartId} is not null and ${order.checkoutPaidAt} is null and ${order.importedFrom} is null and coalesce(${order.paymentMethod}, 'manual') not in ('cod', 'manual') and ${order.status} in ('open', 'cancelled'))`
const paymentFinished = sql`not ${paymentNotFinished}`

/**
 * What each tab shows. Unpaid and Unfulfilled are work still to do, so only
 * open orders count; Pending UPI is a manual transfer whose checkout amount
 * has not been matched yet.
 */
/** A list tab's rows; Home's to-do counts use the same rule so their number matches the list they open. */
export function viewFilter(view: OrderView): SQL | undefined {
  switch (view) {
    case 'unpaid':
      return and(
        eq(order.status, 'open'),
        inArray(order.paymentStatus, [...UNPAID_PAYMENT_STATUSES]),
        paymentFinished,
      )
    case 'unfulfilled':
      // Imported history is a read-only record: nothing on it is left to ship.
      return and(
        eq(order.status, 'open'),
        inArray(order.fulfillmentStatus, [...UNFULFILLED_STATUSES]),
        isNull(order.importedFrom),
        paymentFinished,
      )
    case 'pending_upi':
      return and(
        eq(order.status, 'open'),
        isNull(order.checkoutPaidAt),
        eq(order.paymentMethod, 'manual'),
        isNull(order.importedFrom),
      )
    case 'balance_due':
      // Deposit pre-orders whose balance is still owed (Home's "pre-orders waiting on balance").
      return and(
        gt(order.balanceDuePaise, 0),
        isNull(order.balancePaidAt),
        isNull(order.importedFrom),
        ne(order.status, 'cancelled'),
      )
    case 'completed':
      return eq(order.status, 'completed')
    case 'cancelled':
      return and(eq(order.status, 'cancelled'), paymentFinished)
    case 'payment_not_finished':
      return paymentNotFinished
    default:
      return paymentFinished
  }
}
