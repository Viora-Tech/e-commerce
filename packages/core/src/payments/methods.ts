/** SOURCE OF TRUTH: checkout payment methods — WHAT the merchant's "Shoppers can pay with" row means / WHY one pure module orders checkout for admin, storefront and gateways */
import { z } from 'zod'

/*
 * Pure (no database, no gateway SDK), so the admin's client components import it
 * through `@commerce/core/payment-methods`.
 *
 * The merchant thinks in methods (UPI, cards, COD), not providers. A method row
 * is one of these ids with an on/off flag; the row's order is the checkout
 * order. Online methods are taken by the main gateway (Razorpay, Cashfree);
 * `cod` is the built-in cash on delivery provider.
 */

export const ONLINE_METHOD_IDS = ['upi', 'card', 'netbanking', 'wallet', 'emi'] as const
export type OnlineMethodId = (typeof ONLINE_METHOD_IDS)[number]

export const CHECKOUT_METHOD_IDS = [...ONLINE_METHOD_IDS, 'cod'] as const
export type CheckoutMethodId = (typeof CHECKOUT_METHOD_IDS)[number]

export const CheckoutMethodSchema = z.object({
  id: z.enum(CHECKOUT_METHOD_IDS),
  on: z.boolean(),
})
export type CheckoutMethod = z.infer<typeof CheckoutMethodSchema>

/** Gateways that take the online methods. The first one enabled is the main way to get paid. */
export const GATEWAY_PROVIDER_IDS = ['razorpay', 'cashfree'] as const

/** New stores: UPI, cards and netbanking on; wallets, EMI and COD off. */
export const DEFAULT_CHECKOUT_METHODS: CheckoutMethod[] = [
  { id: 'upi', on: true },
  { id: 'card', on: true },
  { id: 'netbanking', on: true },
  { id: 'wallet', on: false },
  { id: 'emi', on: false },
  { id: 'cod', on: false },
]

export const isOnlineMethod = (id: string): id is OnlineMethodId =>
  (ONLINE_METHOD_IDS as readonly string[]).includes(id)

export const isGatewayProvider = (id: string): boolean =>
  (GATEWAY_PROVIDER_IDS as readonly string[]).includes(id)

type MethodSource = {
  enabled: string[]
  methods?: CheckoutMethod[] | undefined
  providers?: Record<string, Record<string, string>> | undefined
}

/**
 * The method row for a store, always complete (every id once) and in order.
 * Stores saved before the row existed get the defaults, with COD reflecting
 * whether cash on delivery is on and EMI whether Razorpay's EMI switch is.
 */
export function checkoutMethodsOf(settings: MethodSource): CheckoutMethod[] {
  const saved = settings.methods
  if (!saved?.length) {
    return DEFAULT_CHECKOUT_METHODS.map((m) => {
      if (m.id === 'cod') return { ...m, on: settings.enabled.includes('cod') }
      if (m.id === 'emi') return { ...m, on: settings.providers?.razorpay?.enableEmi === 'true' }
      return m
    })
  }
  const seen = new Set<string>()
  const out: CheckoutMethod[] = []
  for (const m of saved) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m)
  }
  for (const m of DEFAULT_CHECKOUT_METHODS) if (!seen.has(m.id)) out.push({ ...m, on: false })
  return out
}

/** The online methods turned on, in checkout order: what the gateway window should offer. */
export function onlineMethodsOn(methods: CheckoutMethod[]): OnlineMethodId[] {
  return methods.filter((m) => m.on && isOnlineMethod(m.id)).map((m) => m.id as OnlineMethodId)
}

/**
 * True when a gateway (Razorpay or Cashfree) is enabled and EMI is on in the
 * method row (or, before the row existed, Razorpay's EMI switch). Both
 * gateways offer card EMI, cardless EMI and pay later in their own window.
 */
export function gatewayOffersEmi(settings: MethodSource): boolean {
  if (!settings.enabled.some(isGatewayProvider)) return false
  return checkoutMethodsOf(settings).some((m) => m.id === 'emi' && m.on)
}

/** The store's main gateway: the first enabled gateway, else the first configured one. */
export function primaryGatewayOf(settings: MethodSource): string | null {
  const on = settings.enabled.find(isGatewayProvider)
  if (on) return on
  const saved = Object.keys(settings.providers ?? {}).find(
    (id) => isGatewayProvider(id) && Object.values(settings.providers?.[id] ?? {}).some(Boolean),
  )
  return saved ?? null
}

/**
 * The `enabled` provider list that makes checkout follow the method row: the
 * main gateway sits where the first online method is (and is dropped when
 * every online method is off), `cod` sits where COD is. Other providers
 * (manual transfer, UPI QR, a second gateway) keep their relative order after.
 */
export function enabledForMethods(
  enabled: string[],
  methods: CheckoutMethod[],
  gateway: string | null,
): string[] {
  const anyOnline = onlineMethodsOn(methods).length > 0
  const codOn = methods.some((m) => m.id === 'cod' && m.on)
  const head: string[] = []
  for (const m of methods) {
    if (!m.on) continue
    if (isOnlineMethod(m.id) && gateway && anyOnline && !head.includes(gateway)) head.push(gateway)
    if (m.id === 'cod' && codOn) head.push('cod')
  }
  const rest = enabled.filter((id) => id !== 'cod' && id !== gateway)
  return [...head, ...rest]
}
