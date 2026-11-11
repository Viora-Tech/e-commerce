/** SOURCE OF TRUTH: a delivery option's price at place order — WHAT: re-runs the engine on the courier answers checkout priced the shopper's choice from (the quote snapshot, or cache-only answers), inside the order transaction, and returns the shipping charged and the route saved / WHY: `placeOrder` must never call a courier and never charge more than the shopper saw. */
import { type OrderDeliveryRoute, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../../context'
import { CheckoutRuleViolation, ShippingRateUnavailable } from '../../errors'
import type { ShippingRateOption } from '../rates'
import { parseShippingSettings, toShippingPolicy } from '../settings'
import { type DeliveryChoice, orderDeliveryFor } from './checkout'
import { resolveDeliveryOptions } from './resolve'
import type { ZoneQuote } from './resolve-types'
import type { ProviderAnswer } from './routes'
import { activeDeliveryConfig, cartItemFacts, cartParcelFor } from './service'

/**
 * The shopper's option (and sub-choice and insurance tick) with the courier answers checkout
 * priced it from. Omitted, or the app off: zone rates, as before.
 */
export type OrderDeliveryInput = {
  choice: DeliveryChoice
  answers: ProviderAnswer[]
  /** The prices the snapshot says were shown; null when there is no snapshot for this cart. */
  shown: Record<string, number> | null
}

/**
 * The shipping charged and the route saved for the choice, or null when the app is off (zone
 * rates price the order instead). COD on a prepaid-only option and an option that no longer
 * shows both refuse the order.
 */
export async function priceOrderDelivery(
  ctx: StoreContext,
  delivery: OrderDeliveryInput,
  cart: {
    lines: ReadonlyArray<{ variantId: string; quantity: number }>
    valuePaise: number
    zone: ZoneQuote
    payment: 'prepaid' | 'cod'
  },
): Promise<{
  shipping: ShippingRateOption
  delivery: OrderDeliveryRoute
  backupRateId: string | null
} | null> {
  const config = await activeDeliveryConfig(ctx.tx, ctx.storeId)
  if (!config) return null
  const [s] = await ctx.tx
    .select({ shipping: store.shipping })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const settings = parseShippingSettings(s?.shipping)
  // Billed weight, as checkout priced it (#1546): the cost cards must match what was shown.
  const parcel = await cartParcelFor(ctx.tx, cart.lines, settings.boxPresets)
  const result = resolveDeliveryOptions({
    config,
    cart: {
      valuePaise: cart.valuePaise,
      weightGrams: parcel.billedGrams,
      items: await cartItemFacts(
        ctx.tx,
        cart.lines.map((l) => l.variantId),
      ),
    },
    answers: delivery.answers,
    zone: cart.zone,
    policy: toShippingPolicy(settings),
    now: new Date(),
    declineInsurance: !delivery.choice.insured,
  })
  const out = orderDeliveryFor(result, delivery.choice, cart.payment, delivery.shown, config)
  if (out.ok) {
    return { shipping: out.shipping, delivery: out.delivery, backupRateId: out.backupRateId }
  }
  if (out.problem === 'prepaid_only') {
    throw new CheckoutRuleViolation('cod_prepaid_only_option', { storeId: ctx.storeId })
  }
  throw new ShippingRateUnavailable(delivery.choice.optionId, ctx.storeId)
}
