import { loadEnv } from '@commerce/config'
import {
  builtInPaymentRegistry,
  type PaymentAdjustment,
  parsePaymentSettings,
  resolvePaymentProviders,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { razorpayFactory } from '@commerce/payments-razorpay'
import { eq } from 'drizzle-orm'

/** Adapters this deployment ships. Adding a gateway is one line here. */
export const paymentRegistry = builtInPaymentRegistry().register(razorpayFactory)

export type CheckoutMethod = {
  id: string
  label: string
  /** Fee or discount the merchant attached to this method; undefined when none. */
  adjustment?: PaymentAdjustment | undefined
}

async function loadSettings(tx: StoreTx, storeId: string) {
  const [s] = await tx.select({ payments: store.payments }).from(store).where(eq(store.id, storeId))
  return parsePaymentSettings(s?.payments)
}

/** Providers the store has enabled and configured, in checkout order. */
export async function storePaymentProviders(tx: StoreTx, storeId: string) {
  const settings = await loadSettings(tx, storeId)
  const { providers, errors } = resolvePaymentProviders(
    paymentRegistry,
    settings,
    loadEnv(process.env).SETTINGS_SECRET,
  )
  if (errors.length) console.warn('[payments] misconfigured providers:', errors.join('; '))
  return providers
}

/** What the checkout form shows: one option per configured provider plus its price adjustment. */
export async function storeCheckoutMethods(
  tx: StoreTx,
  storeId: string,
): Promise<CheckoutMethod[]> {
  const settings = await loadSettings(tx, storeId)
  const providers = await storePaymentProviders(tx, storeId)
  return providers.map((p) => ({
    id: p.id,
    label: p.label,
    adjustment: settings.adjustments[p.id],
  }))
}

/** True when Razorpay is enabled with EMI switched on; drives the product-page EMI hint. */
export async function storeOffersEmi(tx: StoreTx, storeId: string): Promise<boolean> {
  const [s] = await tx.select({ payments: store.payments }).from(store).where(eq(store.id, storeId))
  const settings = parsePaymentSettings(s?.payments)
  return settings.enabled.includes('razorpay') && settings.providers.razorpay?.enableEmi === 'true'
}
