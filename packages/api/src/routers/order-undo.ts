import { permissions, undoDelivered } from '@commerce/core'
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
}
