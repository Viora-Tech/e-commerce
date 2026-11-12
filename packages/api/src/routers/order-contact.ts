/** Who an order is for: the contact edit, "Change customer", and who else has an email. Mounted on `orders`. */
import {
  emailOwnerForOrder,
  InvalidOrderContact,
  type MoveOrderResult,
  moveOrderToCustomer,
  OrderNotFound,
  permissions,
  updateOrderContact,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, inputField } from '../procedures'
import { importedSource } from '../services/order.service'

const AddressSchema = z.object({
  line1: z.string().trim().max(200),
  line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80),
  stateCode: z.string().trim().max(2),
  pincode: z.string().trim().max(6),
})

/** A refused move in the words the admin shows. */
function moveRefused(result: Extract<MoveOrderResult, { ok: false }>): never {
  if (result.reason === 'order_not_found') {
    throw new ORPCError('NOT_FOUND', { message: 'Order not found' })
  }
  if (result.reason === 'customer_not_found') {
    throw new ORPCError('NOT_FOUND', { message: 'Customer not found' })
  }
  throw new ORPCError('BAD_REQUEST', {
    message:
      "This order used the current customer's store credit, so it stays with them. Merge the two customers instead.",
  })
}

export const orderContactRoutes = {
  /**
   * "Edit" on the order page's customer card: this order's contact and shipping address,
   * optionally copied to the customer's saved address, and optionally moved to the customer who
   * has the new email. Logged on the timeline; nothing is sent to the shopper. Imported orders
   * take it too (their lines and money stay read-only), except a GSTIN or company name change.
   */
  // Rewriting the customer's saved address, or moving the order to another customer, is a
  // customer edit too.
  updateContact: can(permissions.ORDERS_WRITE, (input) =>
    inputField(input, 'alsoUpdateCustomer') === true ||
    inputField(input, 'moveToEmailOwner') === true
      ? [permissions.CUSTOMERS_WRITE]
      : [],
  )
    .input(
      z.object({
        orderId: z.uuid(),
        name: z.string().trim().max(120),
        email: z.email().max(200).nullable(),
        phone: z.string().trim().max(30).nullable(),
        address: AddressSchema.nullable(),
        alsoUpdateCustomer: z.boolean().default(false),
        /**
         * The new email belongs to another existing customer: also move this order to them
         * (`orders.changeCustomer`). Off unless staff tick it; customers are never merged.
         */
        moveToEmailOwner: z.boolean().default(false),
        /** Left out keeps the order's billing; `address` null bills the shipping address. */
        billing: z
          .object({
            address: AddressSchema.extend({ name: z.string().trim().max(120) }).nullable(),
            businessName: z.string().trim().max(200).nullable(),
            gstin: z.string().trim().max(20).nullable(),
          })
          .optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const ctx = { storeId: context.scope.storeId, tx: context.tx }
      const author = context.session.user.email
      const { moveToEmailOwner, ...contact } = input
      const imported = await importedSource(context.tx, { orderId: input.orderId })
      try {
        const result = await updateOrderContact(ctx, {
          ...contact,
          author,
          lockTax: imported !== null,
        })
        if (!moveToEmailOwner || !input.email) return { ...result, movedToCustomerId: null }
        const owner = await emailOwnerForOrder(ctx, { orderId: input.orderId, email: input.email })
        if (!owner) return { ...result, movedToCustomerId: null }
        const moved = await moveOrderToCustomer(ctx, {
          orderId: input.orderId,
          customerId: owner.id,
          author,
        })
        if (!moved.ok) moveRefused(moved)
        return { ...result, changed: true, movedToCustomerId: owner.id }
      } catch (err) {
        if (err instanceof OrderNotFound) {
          throw new ORPCError('NOT_FOUND', { message: 'Order not found' })
        }
        if (err instanceof InvalidOrderContact) {
          throw new ORPCError('BAD_REQUEST', { message: err.message, data: { errors: err.errors } })
        }
        throw err
      }
    }),

  /**
   * The other existing customer who has this email, for the contact edit's "This email belongs
   * to … also move this order to them?"; null when nobody else has it.
   */
  findEmailOwner: can(permissions.ORDERS_READ, () => [permissions.CUSTOMERS_READ])
    .input(z.object({ orderId: z.uuid(), email: z.string().trim().max(200) }))
    .handler(({ context, input }) =>
      emailOwnerForOrder({ storeId: context.scope.storeId, tx: context.tx }, input),
    ),

  /**
   * "Change customer" on the order page: the order moves to another existing customer (it keeps
   * its own email, phone and addresses), with a line on its timeline and on both customers'.
   */
  changeCustomer: can(permissions.ORDERS_WRITE, () => [permissions.CUSTOMERS_WRITE])
    .input(z.object({ orderId: z.uuid(), customerId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const result = await moveOrderToCustomer(
        { storeId: context.scope.storeId, tx: context.tx },
        { ...input, author: context.session.user.email },
      )
      if (!result.ok) moveRefused(result)
      return { changed: result.changed, fromCustomerId: result.fromCustomerId }
    }),
}
