/**
 * Shared by the Loyalty points routers (`loyalty.ts`, `loyalty-v2.ts`, `loyalty-v2-members.ts`):
 * the installed check, the store context, and how loyalty and store credit refusals answer.
 */
import { LoyaltyError, type LoyaltySettings, loyaltyState, StoreCreditError } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'

export type LoyaltyCtx = { tx: StoreTx; scope: { storeId: string } }

/** The app's settings; PRECONDITION_FAILED when the store has not installed it. */
export async function requireInstalled(context: LoyaltyCtx): Promise<LoyaltySettings> {
  const { installed, settings } = await loyaltyState(context.tx, context.scope.storeId)
  if (!installed) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Loyalty points app first' })
  }
  return settings
}

export const ctxOf = (context: LoyaltyCtx) => ({ storeId: context.scope.storeId, tx: context.tx })

const LOYALTY_CODES = {
  not_found: 'NOT_FOUND',
  invalid: 'BAD_REQUEST',
  insufficient: 'BAD_REQUEST',
  not_eligible: 'FORBIDDEN',
  limit_reached: 'CONFLICT',
  closed: 'PRECONDITION_FAILED',
  used: 'CONFLICT',
} as const

/**
 * Loyalty and store credit refusals as the API reports them, with the loyalty reason in
 * `data.reason` for the admin to narrow on.
 */
export function surface<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((err) => {
    if (err instanceof LoyaltyError) {
      throw new ORPCError(LOYALTY_CODES[err.reason], {
        message: err.message,
        data: { reason: err.reason },
      })
    }
    if (err instanceof StoreCreditError) {
      throw new ORPCError(err.reason === 'not_found' ? 'NOT_FOUND' : 'BAD_REQUEST', {
        message: err.message,
      })
    }
    throw err
  })
}
