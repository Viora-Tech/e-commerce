import { settingsSecret } from '@commerce/config'
import {
  CheckoutDraftNotTakeable,
  parsePaymentSettings,
  resolvePaymentProviders,
  takeOverCheckoutDraft,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { storeRegistries } from './apps.service'

/**
 * "Edit" on a shopper's unpaid checkout: the store's gateways are resolved so core can ask each
 * about the checkout's tries, then the draft becomes a staff draft. A refusal is a 409 carrying
 * its reason, which the admin turns into its own words; a draft not found is a 404.
 */
export async function takeOverStoreCheckoutDraft(
  tx: StoreTx,
  storeId: string,
  input: { id: string; author: string },
) {
  const { payments } = await storeRegistries(tx, storeId)
  const [s] = await tx.select({ payments: store.payments }).from(store).where(eq(store.id, storeId))
  const { providers } = resolvePaymentProviders(
    payments,
    parsePaymentSettings(s?.payments),
    settingsSecret(),
  )
  try {
    return await takeOverCheckoutDraft({ storeId, tx }, input.id, {
      author: input.author,
      providers,
    })
  } catch (err) {
    if (err instanceof CheckoutDraftNotTakeable) {
      throw new ORPCError(err.reason === 'not_found' ? 'NOT_FOUND' : 'CONFLICT', {
        message: err.message,
        data: { reason: err.reason },
      })
    }
    throw err
  }
}
