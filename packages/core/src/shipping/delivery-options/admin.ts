/** SOURCE OF TRUTH: the Delivery options app page's data — WHAT: what the app page shows (the
 * connected courier apps, options, rules, route settings and warnings), the routes the apps
 * answer for a PIN code, and Try a PIN (the cards exactly as checkout would draw them, plus
 * every route's quote and why each won or lost) / WHY: the merchant must see the outcome of
 * their options and rules for any PIN and cart before a shopper does.
 */
import { type StoreTx, variant } from '@commerce/db'
import { parsePincode, type ShippingProvider, servesDestination } from '@commerce/shipping'
import { inArray } from 'drizzle-orm'
import { stateForPincode } from '../../checkout/pincode-state'
import type { CartParcel } from '../parcel'
import { quoteShipping } from '../rates'
import { loadRateZones } from '../rates-service'
import { type ShippingSettings, toShippingPolicy } from '../settings'
import { quoteDelivery } from './checkout'
import type { DeliveryConfig } from './config'
import type { DeliveryResolveResult } from './resolve-types'
import { AGGREGATOR_PROVIDERS, type Route, routesFromAnswers } from './routes'
import { cartParcelFor, loadDeliveryConfig, productFacts } from './service'

/** Admin calls wait longer than checkout: the merchant is watching the answer arrive. */
const ADMIN_DEADLINE_MS = 5000

export type ConnectedApp = {
  id: string
  label: string
  channel: 'direct' | 'aggregator'
  prices: boolean
}

export type DeliveryWarning = 'no_options' | 'no_couriers' | 'insurance_unpriced'

export type DeliveryOverview = DeliveryConfig & {
  apps: ConnectedApp[]
  warnings: DeliveryWarning[]
}

/** The connected domestic courier apps checkout would ask. */
function connectedApps(providers: readonly ShippingProvider[]): ConnectedApp[] {
  return providers
    .filter((p) => servesDestination(p, 'IN') && !p.requiresTrackingNumber)
    .map((p) => ({
      id: p.id,
      label: p.label,
      channel: AGGREGATOR_PROVIDERS.has(p.id) ? 'aggregator' : 'direct',
      prices: Boolean(p.quoteOptions || p.quoteRate),
    }))
}

/**
 * Warnings for the page. `insurance_unpriced`: an option insures by default but no route has
 * an insurance rate yet (owner, 29 Oct: Shiprocket and RapidShyp insurance is on, the cost is
 * not known), so insurance is charged at ₹0 until the rate is filled in.
 */
function deliveryWarnings(
  config: DeliveryConfig,
  apps: readonly ConnectedApp[],
): DeliveryWarning[] {
  const out: DeliveryWarning[] = []
  if (config.options.length === 0) out.push('no_options')
  if (apps.length === 0) out.push('no_couriers')
  const insures = config.options.some((o) => o.enabled && o.insurance.default === 'on')
  const priced = config.routeSettings.some(
    (s) => s.insurancePercent != null || s.insuranceMinPaise != null,
  )
  if (insures && !priced) out.push('insurance_unpriced')
  return out
}

export async function deliveryOverview(
  tx: StoreTx,
  providers: readonly ShippingProvider[],
): Promise<DeliveryOverview> {
  const config = await loadDeliveryConfig(tx)
  const apps = connectedApps(providers)
  return { ...config, apps, warnings: deliveryWarnings(config, apps) }
}

export type TryPinInput = {
  pincode: string
  valuePaise: number
  /** Typed weight mode: the weight couriers are asked with. Ignored when `lines` is given. */
  weightGrams: number
  productIds: string[]
  /**
   * Pick products mode: variants and quantities. The parcel is built as checkout builds it
   * (`cartParcelFor`: box, packing, billed weight) and the products come from these variants.
   */
  lines?: Array<{ variantId: string; quantity: number }> | undefined
  declineInsurance: boolean
}

export type TryPinResult = DeliveryResolveResult & {
  routes: Route[]
  stateCode: string | null
  /** Pick products mode: the parcel priced (its box and billed weight); null when typed. */
  parcel: CartParcel | null
}

/** The picked variants' products and their own weight (what Shipping rates price on). */
async function pickedGoods(
  tx: StoreTx,
  lines: ReadonlyArray<{ variantId: string; quantity: number }>,
): Promise<{ productIds: string[]; weightGrams: number }> {
  if (lines.length === 0) return { productIds: [], weightGrams: 0 }
  const rows = await tx
    .select({ id: variant.id, productId: variant.productId, weightGrams: variant.weightGrams })
    .from(variant)
    .where(
      inArray(
        variant.id,
        lines.map((l) => l.variantId),
      ),
    )
  const byId = new Map(rows.map((r) => [r.id, r]))
  return {
    productIds: [...new Set(rows.map((r) => r.productId))],
    weightGrams: lines.reduce(
      (sum, l) => sum + l.quantity * (byId.get(l.variantId)?.weightGrams ?? 0),
      0,
    ),
  }
}

/** Try a PIN: the options as checkout would show them for this PIN and cart, with the trace. */
export async function tryDeliveryPin(
  tx: StoreTx,
  storeId: string,
  providers: readonly ShippingProvider[],
  settings: ShippingSettings,
  input: TryPinInput,
  now: Date = new Date(),
): Promise<TryPinResult> {
  const parsed = parsePincode(input.pincode)
  if (!parsed.ok) throw new Error('Enter a 6 digit PIN code.')
  const config = await loadDeliveryConfig(tx)
  const stateCode = stateForPincode(parsed.pincode)
  const lines = input.lines?.length ? input.lines : null
  // Pick products: the box and billed weight checkout would price these goods on (#1546).
  const parcel = lines ? await cartParcelFor(tx, lines, settings.boxPresets) : null
  const goods = lines ? await pickedGoods(tx, lines) : null
  const weightGrams = parcel?.billedGrams ?? input.weightGrams
  const zone = quoteShipping(
    await loadRateZones(tx),
    { stateCode: stateCode ?? '', pincode: parsed.pincode },
    // Shipping rates read the products' own weight, as at checkout.
    { valuePaise: input.valuePaise, weightGrams: goods?.weightGrams ?? input.weightGrams },
  )
  const policy = toShippingPolicy(settings)
  const { result, answers } = await quoteDelivery({
    storeId,
    providers,
    config,
    query: {
      originPincode: policy.originPincode,
      destinationPincode: parsed.pincode,
      weightGrams,
      dimensionsCm: parcel?.dimensionsCm,
      valuePaise: input.valuePaise,
    },
    cart: {
      valuePaise: input.valuePaise,
      weightGrams,
      items: await productFacts(tx, goods?.productIds ?? input.productIds),
    },
    zone,
    policy,
    now,
    declineInsurance: input.declineInsurance,
    deadlineMs: ADMIN_DEADLINE_MS,
  })
  return {
    ...result,
    routes: routesFromAnswers(answers, config.routeSettings, weightGrams),
    stateCode,
    parcel,
  }
}
