import { settingsSecret } from '@commerce/config'
import { OrderEditSchema, permissions, REFUND_ROUTES } from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, type StoreScope } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  cancelStoreOrder,
  editStoreOrder,
  orderRefundOptions,
  previewStoreOrderEdit,
  takeOverStoreOrder,
} from '../services/order-edit.service'

const refundRoute = z.enum(REFUND_ROUTES)

/** Money going back is its own grant (`orders.refund`), on top of cancelling or editing. */
function assertCanRefund(
  scope: Pick<StoreScope, 'can' | 'roleSlug'>,
  route: z.infer<typeof refundRoute>,
) {
  if (route !== 'none' && !scope.can(permissions.ORDERS_REFUND)) {
    throw new ORPCError('FORBIDDEN', {
      message: 'Your role does not allow refunds; choose "No refund" or ask an owner',
      data: { required: permissions.ORDERS_REFUND, role: scope.roleSlug },
    })
  }
}

async function paymentsDeps(tx: Parameters<typeof storeRegistries>[0], storeId: string) {
  const { payments } = await storeRegistries(tx, storeId)
  return { registry: payments, secret: settingsSecret() }
}

/** Cancel with options, take over an imported order, and edit a placed order. Mounted on `orders`. */
export const orderEditRoutes = {
  /** How a refund on this order can go back: how much is left, and to the original payment or not. */
  refundOptions: can(permissions.ORDERS_READ)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) =>
      orderRefundOptions(
        context.tx,
        context.scope.storeId,
        await paymentsDeps(context.tx, context.scope.storeId),
        input.orderId,
      ),
    ),

  /**
   * "Cancel order": a reason, restock on or off, tell the customer or not, and how the money
   * goes back (original payment, recorded by hand, or not at all). An imported order that is
   * still open is taken over first. Logged on the timeline.
   */
  cancel: can(permissions.ORDERS_CANCEL)
    .input(
      z.object({
        orderId: z.uuid(),
        reason: z.string().trim().max(500).optional(),
        restock: z.boolean(),
        notifyCustomer: z.boolean(),
        refund: refundRoute,
      }),
    )
    .handler(async ({ context, input }) => {
      assertCanRefund(context.scope, input.refund)
      return cancelStoreOrder(
        context.tx,
        context.scope.storeId,
        await paymentsDeps(context.tx, context.scope.storeId),
        { ...input, author: context.session.user.email },
      )
    }),

  /**
   * "Manage this order" (Imported card): an imported order that is still open becomes one worked
   * here (ship, cancel, edit). Stock is not taken again. Logged on the timeline.
   */
  takeOver: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid() }))
    .handler(({ context, input }) =>
      takeOverStoreOrder(
        context.tx,
        context.scope.storeId,
        input.orderId,
        context.session.user.email,
      ),
    ),

  /** The edit's review step: new lines and totals, and what is owed either way. Saves nothing. */
  editPreview: can(permissions.ORDERS_WRITE)
    .input(OrderEditSchema)
    .handler(async ({ context, input }) =>
      previewStoreOrderEdit(
        context.tx,
        context.scope.storeId,
        await paymentsDeps(context.tx, context.scope.storeId),
        input,
      ),
    ),

  /**
   * Save an order edit (add, remove, quantities, shipping, discount) on an open order not yet
   * shipped. Stock, parcels and GST follow; a higher total opens a balance (emailed as a pay
   * link with `requestPayment`), a lower one is refunded the chosen way.
   */
  edit: can(permissions.ORDERS_WRITE)
    .input(
      OrderEditSchema.extend({
        refund: refundRoute,
        requestPayment: z.boolean(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      assertCanRefund(context.scope, input.refund)
      const { refund, requestPayment, note, ...edit } = input
      return editStoreOrder(
        context.tx,
        context.scope.storeId,
        await paymentsDeps(context.tx, context.scope.storeId),
        edit,
        { refund, requestPayment, note, author: context.session.user.email },
      )
    }),
}
