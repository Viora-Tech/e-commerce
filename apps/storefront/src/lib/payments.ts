import { loadEnv } from '@commerce/config'
import {
  builtInPaymentRegistry,
  parsePaymentSettings,
  resolvePaymentProviders,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { razorpayFactory } from '@commerce/payments-razorpay'
import { eq } from 'drizzle-orm'

/** Adapters this deployment ships. Adding a gateway is one line here. */
export const paymentRegistry = builtInPaymentRegistry().register(razorpayFactory)

/** Providers the store has enabled and configured, in checkout order. */
export async function storePaymentProviders(tx: StoreTx, storeId: string) {
  const [s] = await tx.select({ payments: store.payments }).from(store).where(eq(store.id, storeId))
  const settings = parsePaymentSettings(s?.payments)
  const { providers, errors } = resolvePaymentProviders(
    paymentRegistry,
    settings,
    loadEnv(process.env).SETTINGS_SECRET,
  )
  if (errors.length) console.warn('[payments] misconfigured providers:', errors.join('; '))
  return providers
}
