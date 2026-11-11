import { settingsSecret } from '@commerce/config'
import { ORDER_CANCEL_REASONS, OrderEditSchema, permissions, REFUND_ROUTES } from '@commerce/core'
import { z } from 'zod'
import { type AlsoNeeds, can, inputField } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  cancelOrderLabel,
  cancelStoreOrder,
  editStoreOrder,
  orderRefundOptions,
  previewStoreOrderEdit,
  takeOverStoreOrder,
} from '../services/order-edit.service'

const refundRoute = z.enum(REFUND_ROUTES)
/** An edit's refund: store credit is offered on cancel only for now. */
const editRefundRoute = refundRoute.exclude(['store_credit'])

/**
 * Money going back is its own grant (`orders.refund`, and its "Needs approval" tick), on top of
 * cancelling or editing: the same as a refund from the payment card (`orders.refund`).
 */
const refundNeeds = (input: unknown) => {
  const route = inputField(input, 'refund')
  return route !== undefined && route !== 'none' ? [permissions.ORDERS_REFUND] : []
}

/** Cancel order: the refund's grant, and "Also cancel courier label" is Cancel shipment's grant. */
const cancelNeeds: AlsoNeeds = (input) => [
  ...refundNeeds(input),
  ...(inputField(input, 'cancelShipmentId') ? [permissions.ORDERS_FULFIL] : []),
]

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
  cancel: can(permissions.ORDERS_CANCEL, cancelNeeds)
    .input(
      z.object({
        orderId: z.uuid(),
        /** The reason picked from the list (#125). */
        reasonCode: z.enum(ORDER_CANCEL_REASONS).optional(),
        /** An optional note with it; older clients send their free-text reason here. */
        reason: z.string().trim().max(500).optional(),
        restock: z.boolean(),
        notifyCustomer: z.boolean(),
        refund: refundRoute,
        /** Store credit's last day (YYYY-MM-DD); left out, it never expires. */
        storeCreditExpiresOn: z.iso.date().optional(),
        /**
         * The Orders list's bulk "Cancel orders" (#1408): refused with BAD_REQUEST (code
         * ORDER_NEEDS_REFUND_DECISION) unless the order has nothing to refund.
         */
        onlyWithoutRefund: z.boolean().optional(),
        /**
         * "Also cancel courier label": this order's live label is cancelled with the courier
         * first (the Cancel shipment path, which unpacks it), then the order. If the courier
         * refuses, nothing is cancelled and the courier's reason comes back.
         */
        cancelShipmentId: z.uuid().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { storeId } = context.scope
      const deps = await paymentsDeps(context.tx, storeId)
      const { cancelShipmentId, ...cancel } = input
      if (cancelShipmentId) {
        await cancelOrderLabel(context.tx, storeId, {
          orderId: input.orderId,
          shipmentId: cancelShipmentId,
          author: context.session.user.email,
        })
      }
      return cancelStoreOrder(context.tx, storeId, deps, {
        ...cancel,
        author: context.session.user.email,
        // Store credit may make the guest's customer record, whose phone is stored encrypted.
        settingsSecret: deps.secret,
      })
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
   * Save an order edit (add catalogue or custom items, remove with or without restock,
   * quantities, prices of unpacked lines, shipping, discount) on an open or completed order,
   * shipped or not (#1014). Stock, parcels and GST follow; new items after fulfilment go in a new
   * parcel; a higher total opens a balance (emailed as a pay link with `requestPayment`), a lower
   * one is refunded the chosen way.
   */
  edit: can(permissions.ORDERS_WRITE, refundNeeds)
    .input(
      OrderEditSchema.extend({
        refund: editRefundRoute,
        requestPayment: z.boolean(),
        note: z.string().trim().max(500).optional(),
        /** Send the customer the updated order (`order_edited`); on unless false. */
        notifyCustomer: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { refund, requestPayment, note, notifyCustomer, ...edit } = input
      return editStoreOrder(
        context.tx,
        context.scope.storeId,
        await paymentsDeps(context.tx, context.scope.storeId),
        edit,
        { refund, requestPayment, note, notifyCustomer, author: context.session.user.email },
      )
    }),
}
