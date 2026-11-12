/** "Merge with another customer" on the customer page. Mounted on `customers`. */
import {
  customerWithEmail,
  mergeCustomers,
  permissions,
  previewCustomerMerge,
  StoreCreditError,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

/** A refused merge in the words the admin shows. */
function mergeRefused(reason: 'same' | 'not_found' | 'anonymised'): never {
  if (reason === 'not_found') throw new ORPCError('NOT_FOUND', { message: 'Customer not found' })
  throw new ORPCError('BAD_REQUEST', {
    message:
      reason === 'same'
        ? 'Pick a different customer to merge with.'
        : 'An erased or already merged customer cannot be merged.',
  })
}

/**
 * A customer's new email that another customer already has is refused (CONFLICT, with who has
 * it): two records of one shopper are merged, never given the same email.
 */
export async function refuseTakenEmail(
  context: { tx: StoreTx; scope: { storeId: string } },
  email: string,
  customerId: string,
): Promise<void> {
  const ctx = { tx: context.tx, storeId: context.scope.storeId }
  const existingId = await customerWithEmail(ctx, email, customerId)
  if (!existingId) return
  throw new ORPCError('CONFLICT', {
    message:
      'Another customer already has this email. Use "Merge with another customer" to make them one.',
    data: { field: 'email', existingId },
  })
}

export const customerMergeRoutes = {
  /**
   * The merge dialog's summary: both customers and what would move from `mergeId` onto
   * `keepId` (orders, addresses, store credit, gift cards, sign-ins, carts, notes, reviews).
   */
  previewMerge: can(permissions.CUSTOMERS_READ)
    .input(z.object({ keepId: z.uuid(), mergeId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const result = await previewCustomerMerge(
        { tx: context.tx, storeId: context.scope.storeId },
        input.keepId,
        input.mergeId,
      )
      if (!result.ok) mergeRefused(result.reason)
      return result
    }),

  /**
   * "Merge with another customer": everything `mergeId` holds moves onto `keepId` in one
   * transaction, with the email, phone and name chosen in `keep`; the other record is closed
   * (erased stub) and its sign-ins end. It removes a customer, so it needs delete too.
   */
  merge: can(permissions.CUSTOMERS_WRITE, () => [permissions.CUSTOMERS_DELETE])
    .input(
      z.object({
        keepId: z.uuid(),
        mergeId: z.uuid(),
        keep: z
          .object({
            email: z.enum(['kept', 'merged']),
            phone: z.enum(['kept', 'merged']),
            name: z.enum(['kept', 'merged']),
          })
          .partial()
          .optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const result = await mergeCustomers(
        { tx: context.tx, storeId: context.scope.storeId },
        {
          ...input,
          author: context.session.user.email,
          actor: {
            type: 'staff',
            id: context.scope.userId,
            label: context.session.user.name?.trim() || context.session.user.email,
          },
        },
      ).catch((err: unknown) => {
        if (err instanceof StoreCreditError) {
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        }
        throw err
      })
      if (!result.ok) mergeRefused(result.reason)
      return result
    }),
}
