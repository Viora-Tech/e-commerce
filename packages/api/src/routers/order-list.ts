import { permissions } from '@commerce/core'
import { z } from 'zod'
import { BULK_MAX, can, heavy } from '../procedures'
import { setOrderTags } from '../services/order.service'
import { orderSheet } from '../services/order-sheet.service'
import { tagOrders } from '../services/order-tags.service'

/** The orders list's sheet and tag routes, mounted flat on `orders` (`orders.sheet`, ...). */
export const orderListRoutes = {
  /** Rows for the Orders bulk-edit spreadsheet, in the order the ids were given. */
  sheet: can(permissions.ORDERS_READ)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(5000) }))
    .handler(({ context, input }) => orderSheet(context.tx, input.ids)),

  setTags: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid(), tags: z.array(z.string().trim().min(1).max(40)).max(20) }))
    .handler(({ context, input }) => setOrderTags(context.tx, input.id, input.tags)),

  /** The list's bulk "Add tags" / "Remove tags": every given tag on (or off) every order. */
  tagMany: can(permissions.ORDERS_WRITE)
    .use(heavy('bulk'))
    .input(
      z.object({
        ids: z.array(z.uuid()).min(1).max(BULK_MAX),
        tags: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
        action: z.enum(['add', 'remove']),
      }),
    )
    .handler(({ context, input }) => tagOrders(context.tx, input)),
}
