import { permissions, restoreCancelledOrder, undoDelivered, undoPacked } from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { assertNotImported } from './imported-order'

/** Undo buttons on the order page, mounted on `orders` in one line (router file-size sweep). */
export const orderUndoRoutes = {
  /** "Mark as not delivered": undo a "Mark as delivered" pressed by mistake. */
  markNotDelivered: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.id })
      const undone = await undoDelivered(
        { tx: context.tx, storeId: context.scope.storeId },
        input.id,
        context.session.user.email,
      )
      return { undone }
    }),

  /** "Mark as not shipped": packed items back to To ship when no courier booking is live. */
  markNotShipped: can(permissions.ORDERS_FULFIL)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.id })
      const r = await undoPacked(
        { tx: context.tx, storeId: context.scope.storeId },
        input.id,
        context.session.user.email,
      )
      if (r.undone) return r
      throw new ORPCError('BAD_REQUEST', { message: NOT_SHIPPED_REFUSED[r.reason] })
    }),

  /** "Restore order": a cancel pressed by mistake; refused once money went back. */
  restore: can(permissions.ORDERS_CANCEL)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.id })
      const r = await restoreCancelledOrder(
        { tx: context.tx, storeId: context.scope.storeId },
        input.id,
        context.session.user.email,
      )
      if (r.restored) return r
      throw new ORPCError('BAD_REQUEST', { message: RESTORE_REFUSED[r.reason] })
    }),
}

const RESTORE_REFUSED = {
  not_cancelled: 'This order is not cancelled.',
  refunded:
    'Money was refunded on this order, so it cannot be restored. Create a new order instead.',
  credit_returned:
    'Store credit went back to the customer when it was cancelled, so it cannot be restored. Create a new order instead.',
} as const

const NOT_SHIPPED_REFUSED = {
  not_packed: 'Nothing on this order is packed.',
  live_shipment: 'A courier booking is still live. Cancel the shipment first.',
  delivered: 'This order is marked delivered. Mark it as not delivered first.',
} as const
