/**
 * A customer's store credit (`storeCredit.*`): the balance and its history, staff adding (with an
 * optional expiry date) or removing credit with a reason, and moving old store-credit gift cards
 * into balances. Changing a balance moves money, so through MCP or the API it always waits for a
 * person (`SENSITIVE_PATHS` in `mcp/action-catalogue.ts`).
 */
import { settingsSecret } from '@commerce/config'
import {
  changeStoreCredit,
  moveGiftCardsToStoreCredit,
  permissions,
  StoreCreditError,
  storeCreditExpiryAt,
  storeCreditGiftCards,
  storeCreditOf,
  storeCreditReturnDefault,
  storeCreditTimeZone,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can } from '../procedures'

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
   * The store credit an order was paid with, and the expiry the cancel and refund dialogs
   * pre-fill when it goes back: the latest last day among the credit it was spent from, or null
   * when any of it never expires.
   */
  getOrderExpiry: can(permissions.ORDERS_READ)
    .input(z.object({ orderId: z.uuid() }))
    .handler(({ context, input }) =>
      storeCreditReturnDefault({ storeId: context.scope.storeId, tx: context.tx }, input.orderId),
    ),

  /**
   * Add (positive `amountPaise`) or remove (negative) store credit, with a reason the history
   * shows. A removal larger than the balance is refused and nothing changes. Added credit may
   * have `expiresOn` (`YYYY-MM-DD`, the last day it can be spent, store time); left out it never
   * expires.
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
        expiresOn: z.iso.date().nullish(),
      }),
    )
    .handler(({ context, input }) =>
      surface(async () => {
        const ctx = { storeId: context.scope.storeId, tx: context.tx }
        const expiresAt = input.expiresOn
          ? storeCreditExpiryAt(input.expiresOn, await storeCreditTimeZone(ctx))
          : null
        return changeStoreCredit(ctx, {
          customerId: input.customerId,
          amountPaise: input.amountPaise,
          kind: 'adjustment',
          reason: input.reason,
          staff: { userId: context.scope.userId, email: context.session.user.email },
          expiresAt,
        })
      }),
    ),

  /**
   * The live gift cards that were really store credit: refund cards made before store credit
   * was a balance, and cards the Shopify import brought over, with whose balance each goes to.
   */
  listGiftCards: can(permissions.CUSTOMERS_READ).handler(({ context }) =>
    storeCreditGiftCards({ storeId: context.scope.storeId, tx: context.tx }),
  ),

  /**
   * Move the picked gift cards into their customers' store credit balances: each card's value
   * left becomes store credit, the card is emptied and disabled. Running it again on a card
   * already moved changes nothing.
   */
  moveGiftCards: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ giftCardIds: z.array(z.uuid()).min(1).max(BULK_MAX) }))
    .handler(({ context, input }) =>
      surface(() =>
        moveGiftCardsToStoreCredit(
          { storeId: context.scope.storeId, tx: context.tx },
          {
            giftCardIds: input.giftCardIds,
            secret: settingsSecret(),
            staff: { userId: context.scope.userId, email: context.session.user.email },
          },
        ),
      ),
    ),
}
