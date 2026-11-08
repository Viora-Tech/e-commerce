/**
 * A customer's store credit (`storeCredit.*`): the balance and its history, and staff adding or
 * removing credit with a reason. Changing a balance moves money, so through MCP or the API it
 * always waits for a person (`SENSITIVE_PATHS` in `mcp/action-catalogue.ts`).
 */
import { changeStoreCredit, permissions, StoreCreditError, storeCreditOf } from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

/** Store credit errors as the API reports them: a missing customer is 404, the rest 400. */
function surface<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((err) => {
    if (err instanceof StoreCreditError) {
      throw new ORPCError(err.reason === 'not_found' ? 'NOT_FOUND' : 'BAD_REQUEST', {
        message: err.message,
      })
    }
    throw err
  })
}

export const storeCreditRouter = {
  /** The customer's balance in paise and their newest 50 changes, newest first. */
  get: can(permissions.CUSTOMERS_READ)
    .input(z.object({ customerId: z.uuid() }))
    .handler(({ context, input }) =>
      storeCreditOf({ storeId: context.scope.storeId, tx: context.tx }, input.customerId),
    ),

  /**
   * Add (positive `amountPaise`) or remove (negative) store credit, with a reason the history
   * shows. A removal larger than the balance is refused and nothing changes.
   */
  adjust: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        customerId: z.uuid(),
        amountPaise: z
          .number()
          .int()
          .refine((n) => n !== 0, 'Enter an amount'),
        reason: z.string().trim().min(1).max(200),
      }),
    )
    .handler(({ context, input }) =>
      surface(() =>
        changeStoreCredit(
          { storeId: context.scope.storeId, tx: context.tx },
          {
            customerId: input.customerId,
            amountPaise: input.amountPaise,
            kind: 'adjustment',
            reason: input.reason,
            staff: { userId: context.scope.userId, email: context.session.user.email },
          },
        ),
      ),
    ),
}
