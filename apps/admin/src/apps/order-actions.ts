/**
 * App order actions in the admin: which of the actions installed apps declare show on one menu
 * for one order, in the member's language, and where a link or Create shipment goes. Pure, so
 * the menus' rules are unit tested. The server already dropped apps that are not installed and
 * set up, and actions the member may not run (`api.apps.orderActions`).
 */
import { UNFULFILLED_STATUSES, UNPAID_PAYMENT_STATUSES } from '@commerce/core/order-status'
import type { api } from '@/lib/api-client'
import type { Locale } from '@/lib/i18n'
import { routes } from '@/lib/routes'

export type OrderActionGroup = Awaited<ReturnType<typeof api.apps.orderActions>>[number]
/** `OrderAction` from `@commerce/plugins`, as the API sends it. */
export type OrderAction = OrderActionGroup['actions'][number]
export type OrderActionTarget = OrderAction['targets'][number]
export type OrderActionCondition = NonNullable<OrderAction['requires']>[number]

/** What the conditions look at, from an Orders list row or the order page. */
export type OrderFacts = {
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  paymentMethod: string | null
  isTest: boolean
}

const UNFULFILLED: ReadonlySet<string> = new Set(UNFULFILLED_STATUSES)
const UNPAID: ReadonlySet<string> = new Set(UNPAID_PAYMENT_STATUSES)

/** Whether an order meets one of an action's conditions. */
export function meets(order: OrderFacts, condition: OrderActionCondition): boolean {
  switch (condition) {
    case 'open':
      return order.status === 'open'
    case 'unfulfilled':
      return UNFULFILLED.has(order.fulfillmentStatus)
    case 'paid-or-cod':
      return !UNPAID.has(order.paymentStatus) || order.paymentMethod === 'cod'
    case 'not-test':
      return !order.isTest
  }
}

/** Open, units still to pack, and paid or cash on delivery: the order can be shipped now. */
export const readyToShip = (order: OrderFacts) =>
  meets(order, 'open') && meets(order, 'unfulfilled') && meets(order, 'paid-or-cod')

/**
 * The groups and actions for one menu: actions placed on `target`, whose conditions the order
 * meets (the bulk bar passes no order and keeps them all; the handler skips what it cannot do),
 * and that the admin can run (`runnable`: a procedure needs its registered call). Apps left
 * with nothing drop out.
 */
export function actionsFor(
  groups: readonly OrderActionGroup[],
  target: OrderActionTarget,
  order: OrderFacts | null,
  runnable: (action: OrderAction) => boolean,
): OrderActionGroup[] {
  return groups.flatMap((g) => {
    const actions = g.actions.filter(
      (a) =>
        a.targets.includes(target) &&
        (!order || (a.requires ?? []).every((c) => meets(order, c))) &&
        runnable(a),
    )
    return actions.length ? [{ ...g, actions }] : []
  })
}

/** The action's name in the member's language; English when the app has no Hindi. */
export const actionLabel = (action: OrderAction, locale: Locale) =>
  (locale === 'hi' ? action.label.hi : undefined) || action.label.en

/** A `link` action's path with `{orderId}` and `{orderIds}` filled in. */
export function linkPath(path: string, orderIds: readonly string[]): string {
  const ids = orderIds.map(encodeURIComponent)
  return path.replaceAll('{orderIds}', ids.join(',')).replaceAll('{orderId}', ids[0] ?? '')
}

/** One order's Create shipment page with a courier picked. */
export const shipmentHref = (orderId: string, providerId: string) =>
  `${routes.orders.ship(orderId)}?courier=${encodeURIComponent(providerId)}`
