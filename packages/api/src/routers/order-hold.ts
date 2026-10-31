/** "Hold fulfilment" and "Release hold" on the order page (#1011). Mounted on `orders`. */
import {
  CommerceError,
  FULFILLMENT_HOLD_REASONS,
  holdOrderByStaff,
  permissions,
  releaseOrderByStaff,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { assertNotImported } from './imported-order'

/** A core refusal (closed, shipped, already held) in the words the admin shows. */
function refused(err: unknown): never {
  if (err instanceof CommerceError) throw new ORPCError('BAD_REQUEST', { message: err.message })
  throw err
}

export const orderHoldRoutes = {
  /** Hold every unshipped parcel with a reason: no shipment, fulfil or "Mark as" until released. */
  holdFulfillment: can(permissions.ORDERS_FULFIL)
    .input(
      z.object({
        orderId: z.uuid(),
        reason: z.enum(FULFILLMENT_HOLD_REASONS),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      const ctx = { storeId: context.scope.storeId, tx: context.tx }
      const held = await holdOrderByStaff(ctx, {
        ...input,
        author: context.session.user.email,
      }).catch(refused)
      return { held: held.length }
    }),

  /** Release the hold: the order goes back to where it was (to pack, or partly shipped). */
  releaseFulfillment: can(permissions.ORDERS_FULFIL)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const ctx = { storeId: context.scope.storeId, tx: context.tx }
      const released = await releaseOrderByStaff(ctx, {
        orderId: input.orderId,
        author: context.session.user.email,
      })
      return { released: released.length }
    }),
}
