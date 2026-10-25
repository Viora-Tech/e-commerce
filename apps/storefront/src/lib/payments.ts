import 'server-only'
import { settingsSecret } from '@commerce/config'
import {
  checkoutMethodsOf,
  gatewayOffersEmi,
  isGatewayProvider,
  type OnlineMethodId,
  onlineMethodsOn,
  type PaymentAdjustment,
  parsePaymentSettings,
  refreshPaymentCredentials,
  resolvePaymentProviders,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { eq } from 'drizzle-orm'

export type CheckoutMethod = {
  id: string
  label: string
  /** Fee or discount the merchant attached to this method; undefined when none. */
  adjustment?: PaymentAdjustment | undefined
  /** For the main gateway: the ways to pay the merchant turned on, in their order. */
  methods?: OnlineMethodId[] | undefined
  /** The gateway runs on its test keys: shown as "Test mode", no real money moves. */
  test?: boolean | undefined
}

async function loadSettings(tx: StoreTx, storeId: string) {
  const [s] = await tx.select({ payments: store.payments }).from(store).where(eq(store.id, storeId))
  return parsePaymentSettings(s?.payments)
}

/** Providers the store has enabled and configured, in checkout order. */
export async function storePaymentProviders(tx: StoreTx, storeId: string) {
  const { payments } = await registriesForStore(tx, storeId)
  const secret = settingsSecret()
  // Renew a gateway's OAuth token before it is used; a no-op unless one is due.
  const refreshed = await refreshPaymentCredentials({ storeId, tx }, payments, secret)
  for (const r of refreshed) {
    if (!r.ok) {
      logger.warn('payment token refresh failed', {
        storeId,
        provider: r.providerId,
        reason: r.error,
      })
    }
  }
  const settings = await loadSettings(tx, storeId)
  const { providers, errors } = resolvePaymentProviders(payments, settings, secret)
  if (errors.length) logger.warn('misconfigured payment providers', { storeId, errors })
  return providers
}

/**
 * What the checkout form shows: one option per configured provider, in the
 * order of the merchant's "Shoppers can pay with" row (the `enabled` list is
 * saved in that order), plus its price adjustment. The main gateway's option
 * carries the online methods it offers, so the shopper sees "UPI, Cards".
 */
export async function storeCheckoutMethods(
  tx: StoreTx,
  storeId: string,
): Promise<CheckoutMethod[]> {
  const providers = await storePaymentProviders(tx, storeId)
  const settings = await loadSettings(tx, storeId)
  const online = settings.methods?.length ? onlineMethodsOn(checkoutMethodsOf(settings)) : null
  return providers
    .filter((p) => !(online && online.length === 0 && isGatewayProvider(p.id)))
    .map((p) => ({
      id: p.id,
      label: p.label,
      adjustment: settings.adjustments[p.id],
      methods: online && isGatewayProvider(p.id) ? online : undefined,
      test: p.mode === 'test' ? true : undefined,
    }))
}

/** True when Razorpay or Cashfree is enabled with EMI on (the method row, or the older EMI switch). */
export async function storeOffersEmi(tx: StoreTx, storeId: string): Promise<boolean> {
  return gatewayOffersEmi(await loadSettings(tx, storeId))
}

/**
 * The store's discount for paying by UPI or bank transfer to its own account (the `manual`
 * method's adjustment), when that method is on and the adjustment takes money off; null
 * otherwise. The product page shows the price after it ("₹6,304 with UPI").
 */
export async function storeUpiDiscount(
  tx: StoreTx,
  storeId: string,
): Promise<PaymentAdjustment | null> {
  const settings = await loadSettings(tx, storeId)
  const adjustment = settings.adjustments.manual
  if (!settings.enabled.includes('manual') || !adjustment || adjustment.value >= 0) return null
  return adjustment
}
