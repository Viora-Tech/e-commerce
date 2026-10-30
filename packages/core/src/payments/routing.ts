/** SOURCE OF TRUTH: multi-gateway payment routing — WHAT which active gateway takes each online method, and which gateways checkout falls back to / WHY one pure module so admin, storefront and the attempt runner agree (audit #148, #150) */
import { z } from 'zod'
import {
  type CheckoutMethod,
  checkoutMethodsOf,
  isGatewayProvider,
  ONLINE_METHOD_IDS,
  type OnlineMethodId,
  onlineMethodsOn,
} from './methods'

/*
 * Pure (no database, no gateway SDK), so the admin's client components can
 * import it through `@commerce/core/payment-routing`.
 *
 * A store may keep several gateways on at once (Razorpay and Cashfree). The
 * merchant orders them (the first is the main way to get paid and the first
 * fallback choice) and may route each online method to one of them, for
 * example UPI to Cashfree and cards to Razorpay. Stores that never saved a
 * routing behave exactly as before: the main gateway takes every method and
 * nothing falls back.
 */

export const PaymentRoutingSchema = z.object({
  /** Active gateways, in fallback order. The first one is the main way to get paid. */
  order: z.array(z.string().min(1).max(40)).max(8).default([]),
  /** Online method id → the gateway that takes it. Unset methods go to the first active gateway that can. */
  methods: z.record(z.string(), z.string().min(1).max(40)).default({}),
})
export type PaymentRouting = z.infer<typeof PaymentRoutingSchema>

/** The online methods a gateway can take (its factory's `methods`); undefined means "all of them". */
export type GatewaySupports = (gatewayId: string) => readonly string[] | undefined

type RoutingSource = {
  enabled: string[]
  methods?: CheckoutMethod[] | undefined
  providers?: Record<string, Record<string, string>> | undefined
  inactive?: Record<string, string[]> | undefined
  routing?: PaymentRouting | undefined
}

/** A gateway that takes longer than this to open a payment counts as down; checkout tries the next one. */
export const GATEWAY_START_TIMEOUT_MS = 15_000

const canTake = (supports: GatewaySupports | undefined, gatewayId: string, method: string) => {
  const list = supports?.(gatewayId)
  return !list || list.includes(method)
}

/**
 * The gateways on at checkout (enabled and not switched off), in fallback
 * order: the merchant's saved order first, then any other enabled gateway in
 * `enabled` order.
 */
export function activeGatewaysOf(s: RoutingSource): string[] {
  const on = s.enabled.filter(
    (id) => isGatewayProvider(id) && !(s.inactive && Object.hasOwn(s.inactive, id)),
  )
  if (!s.routing) return on
  const ordered = s.routing.order.filter((id) => on.includes(id))
  return [...ordered, ...on.filter((id) => !ordered.includes(id))]
}

/**
 * Which active gateway takes each online method: the merchant's pick when it
 * is active and can take that method, else the first active gateway that can.
 * Null when no active gateway takes it.
 */
export function routeMethods(
  s: RoutingSource,
  supports?: GatewaySupports,
): Record<OnlineMethodId, string | null> {
  const active = activeGatewaysOf(s)
  const out = {} as Record<OnlineMethodId, string | null>
  for (const m of ONLINE_METHOD_IDS) {
    const picked = s.routing?.methods[m]
    if (picked && active.includes(picked) && canTake(supports, picked, m)) {
      out[m] = picked
      continue
    }
    out[m] = active.find((id) => canTake(supports, id, m)) ?? null
  }
  return out
}

/**
 * The online methods a gateway's window offers, in checkout order. Undefined
 * for a store that never saved a method row or a routing: the gateway then
 * shows everything it has, as it always did. An empty list means the gateway
 * takes nothing and checkout hides it.
 */
export function methodsForGateway(
  s: RoutingSource,
  gatewayId: string,
  supports?: GatewaySupports,
): OnlineMethodId[] | undefined {
  if (!s.routing && !s.methods?.length) return undefined
  const route = routeMethods(s, supports)
  return onlineMethodsOn(checkoutMethodsOf(s)).filter((m) => route[m] === gatewayId)
}

export type FallbackStep = {
  gatewayId: string
  /** What the fallback gateway's window offers; undefined lets it show everything. */
  methods: OnlineMethodId[] | undefined
}

/**
 * When `failedId` could not open a payment, the gateways to try next, in
 * order: every other active gateway that takes at least one of the methods
 * the shopper was offered, offering only those. Empty for stores without a
 * saved routing, so they behave as before.
 */
export function fallbackChain(
  s: RoutingSource,
  failedId: string,
  methods: OnlineMethodId[] | undefined,
  supports?: GatewaySupports,
): FallbackStep[] {
  if (!s.routing) return []
  return activeGatewaysOf(s)
    .filter((id) => id !== failedId)
    .flatMap((id): FallbackStep[] => {
      if (!methods) return [{ gatewayId: id, methods: undefined }]
      const can = methods.filter((m) => canTake(supports, id, m))
      return can.length ? [{ gatewayId: id, methods: can }] : []
    })
}

/**
 * The routing a merchant's save becomes: only gateways that can be used, each
 * once, and only routes to an active gateway that takes the method.
 */
export function cleanRouting(
  input: { order: string[]; methods: Partial<Record<string, string>> },
  usable: (gatewayId: string) => boolean,
  supports?: GatewaySupports,
): PaymentRouting {
  const order = [...new Set(input.order)].filter((id) => isGatewayProvider(id) && usable(id))
  const methods: Record<string, string> = {}
  for (const m of ONLINE_METHOD_IDS) {
    const id = input.methods[m]
    if (id && order.includes(id) && canTake(supports, id, m)) methods[m] = id
  }
  return { order, methods }
}

/** The `enabled` list with every routed gateway where the online methods sit (see enabledForMethods). */
export function enabledForGateways(
  enabled: string[],
  methods: CheckoutMethod[],
  gateways: string[],
): string[] {
  const anyOnline = onlineMethodsOn(methods).length > 0
  const head: string[] = []
  for (const m of methods) {
    if (!m.on) continue
    if (m.id !== 'cod' && anyOnline && !gateways.some((g) => head.includes(g))) {
      head.push(...gateways)
    }
    if (m.id === 'cod') head.push('cod')
  }
  const rest = enabled.filter((id) => id !== 'cod' && !isGatewayProvider(id))
  return [...head, ...rest]
}
