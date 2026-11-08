/** SOURCE OF TRUTH: the Orders list's tabs — WHAT: which orders each tab (and Home's to-do counts) shows / WHY: one rule for the list, its counts and the dashboard */
import {
  paymentFinished,
  paymentNotFinished,
  UNFULFILLED_STATUSES,
  UNPAID_PAYMENT_STATUSES,
} from '@commerce/core'
import { order } from '@commerce/db'
import { and, eq, gt, inArray, isNotNull, isNull, ne, type SQL } from 'drizzle-orm'

export { paymentFinished, paymentNotFinished }

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
  'archived',
] as const
export type OrderView = (typeof ORDER_VIEWS)[number]

/**
 * What each tab shows. Unpaid and Unfulfilled are work still to do, so only
 * open orders count; Pending UPI is a manual transfer whose checkout amount
 * has not been matched yet.
 */
/**
 * Archived orders (#1007) sit under the Archived tab and leave the working tabs. The Cancelled
 * tab is the one exception: cancelled orders are archived automatically by default, and a
 * merchant who asks for the cancelled ones expects to see them all.
 */
const notArchived = isNull(order.archivedAt)

/** A list tab's rows; Home's to-do counts use the same rule so their number matches the list they open. */
export function viewFilter(view: OrderView): SQL | undefined {
  if (view === 'archived') return isNotNull(order.archivedAt)
  if (view === 'cancelled') return tabFilter(view)
  return and(notArchived, tabFilter(view))
}

function tabFilter(view: Exclude<OrderView, 'archived'>): SQL | undefined {
  switch (view) {
    case 'unpaid':
      return and(
        eq(order.status, 'open'),
        inArray(order.paymentStatus, [...UNPAID_PAYMENT_STATUSES]),
        paymentFinished,
      )
    case 'unfulfilled':
      // Imported orders count too: an order still open on the old platform when the store
      // moved is real work to ship, and "Ready to ship" and the sidebar pill count it (audit #43).
      return and(
        eq(order.status, 'open'),
        inArray(order.fulfillmentStatus, [...UNFULFILLED_STATUSES]),
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
      // Every order, so the numbers run without gaps: a failed payment still took one.
      return undefined
  }
}
