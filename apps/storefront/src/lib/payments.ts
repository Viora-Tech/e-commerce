import 'server-only'
import { settingsSecret } from '@commerce/config'
import {
  checkoutMethodsOf,
  type FallbackTry,
  fallbackChain,
  type GatewaySupports,
  gatewayOffersEmi,
  isGatewayProvider,
  MANUAL_ROW_IDS,
  type ManualRowId,
  manualRowOn,
  manualRowReady,
  methodsForGateway,
  type OnlineMethodId,
  type PaymentAdjustment,
  type PaymentMethodRule,
  type PaymentRegistry,
  parsePaymentSettings,
  refreshPaymentCredentials,
  resolvePaymentProviders,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import type { PaymentProvider } from '@commerce/payments'
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
  /** For the shop's own UPI ID / bank transfer: which of the two rows are on. */
  manualKinds?: ManualRowId[] | undefined
}

/** The online methods each gateway can take, from its app's factory. */
const supportsOf =
  (registry: PaymentRegistry): GatewaySupports =>
  (id) =>
    registry.get(id)?.methods

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
  const supports = supportsOf((await registriesForStore(tx, storeId)).payments)
  const manual = settings.providers.manual
  // Each gateway carries the methods routed to it (all of them for a single gateway); a
  // gateway that takes none is left out.
  return providers.flatMap((p) => {
    const methods = isGatewayProvider(p.id)
      ? methodsForGateway(settings, p.id, supports)
      : undefined
    if (methods && methods.length === 0) return []
    return [
      {
        id: p.id,
        label: p.label,
        adjustment: settings.adjustments[p.id],
        methods,
        test: p.mode === 'test' ? true : undefined,
        manualKinds:
          p.id === 'manual'
            ? MANUAL_ROW_IDS.filter(
                (k) => manualRowOn(settings.manualRows, k) && manualRowReady(k, manual),
              )
            : undefined,
      },
    ]
  })
}

/**
 * The gateways checkout tries next when `providerId` cannot open the payment, in the
 * merchant's fallback order, each offering the methods the shopper was shown (audit #150).
 * Empty for a store with one gateway or without a saved routing.
 */
export async function storePaymentFallbacks(
  tx: StoreTx,
  storeId: string,
  providers: PaymentProvider[],
  providerId: string,
): Promise<FallbackTry<PaymentProvider>[]> {
  if (!isGatewayProvider(providerId)) return []
  const settings = await loadSettings(tx, storeId)
  const supports = supportsOf((await registriesForStore(tx, storeId)).payments)
  const offered = methodsForGateway(settings, providerId, supports)
  return fallbackChain(settings, providerId, offered, supports).flatMap((step) => {
    const provider = providers.find((p) => p.id === step.gatewayId)
    return provider ? [{ provider, methods: step.methods }] : []
  })
}

/** The methods the cart names, from the store's own row, so it never lists one checkout lacks. */
export async function storeCartMethods(tx: StoreTx, storeId: string): Promise<string[]> {
  const settings = await loadSettings(tx, storeId)
  const on = checkoutMethodsOf(settings).filter((m) => m.on)
  const gateway = settings.enabled.some(isGatewayProvider)
  return on.flatMap((m) => {
    if (m.id === 'cod') return settings.enabled.includes('cod') ? [m.id] : []
    return gateway ? [m.id] : []
  })
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

/**
 * Settings → Payments → Payment rules (#150), for the checkout to hide the ways to pay they
 * hide as the total and PIN code change. `placeOrder` re-checks them.
 */
export async function storePaymentMethodRules(
  tx: StoreTx,
  storeId: string,
): Promise<PaymentMethodRule[]> {
  return (await loadSettings(tx, storeId)).methodRules ?? []
}

/** Paid outside a gateway; never the target of "Pay online instead". */
const OFFLINE_METHODS: ReadonlySet<string> = new Set(['manual', 'cod', 'gift_card', 'store_credit'])

/**
 * The gateway a transfer order can pay through instead (issue 1010): the first online option in
 * the store's checkout order. A gateway on its test keys is offered only for a test order, so a
 * real order never "pays" with test money. Null when the store takes no online payments.
 */
export async function payOnlineGateway(
  tx: StoreTx,
  storeId: string,
  isTestOrder: boolean,
): Promise<{ method: CheckoutMethod; provider: PaymentProvider } | null> {
  const methods = await storeCheckoutMethods(tx, storeId)
  const method = methods.find((m) => !OFFLINE_METHODS.has(m.id) && (isTestOrder || !m.test))
  if (!method) return null
  const provider = (await storePaymentProviders(tx, storeId)).find((p) => p.id === method.id)
  return provider ? { method, provider } : null
}
