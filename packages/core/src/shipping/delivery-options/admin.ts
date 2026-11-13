/** SOURCE OF TRUTH: the Delivery options app page's data — WHAT: what the app page shows (the
 * connected courier apps, options, rules, route settings and warnings), the routes the apps
 * answer for a PIN code, and Try a PIN (the cards exactly as checkout would draw them, plus
 * every route's quote and why each won or lost) / WHY: the merchant must see the outcome of
 * their options and rules for any PIN and cart before a shopper does.
 */
import { order, type StoreTx, variant } from '@commerce/db'
import { parsePincode, type ShippingProvider, servesDestination } from '@commerce/shipping'
import { and, gte, inArray, ne, sql } from 'drizzle-orm'
import { stateForPincode } from '../../checkout/pincode-state'
import type { CartParcel } from '../parcel'
import { quoteShipping } from '../rates'
import { loadRateZones } from '../rates-service'
import { type ShippingSettings, toShippingPolicy } from '../settings'
import { quoteDelivery } from './checkout'
import type { DeliveryConfig, DeliveryLayout, DeliveryOption } from './config'
import type { HealthStore } from './health'
import { gatherProviderAnswers } from './quotes'
import type { DeliveryResolveResult } from './resolve-types'
import {
  AGGREGATOR_PROVIDERS,
  COURIER_INSURANCE,
  type CourierInsuranceRate,
  type Route,
  routesFromAnswers,
} from './routes'
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
  /* Every app without a rate of its own: Delhivery direct is priced by its Protect card,
     RapidShyp and Shiprocket by their published rates (COURIER_INSURANCE). */
  const unpriced = apps.filter(
    (a) => !(a.id === 'delhivery' && a.channel === 'direct') && COURIER_INSURANCE[a.id] == null,
  )
  const priced =
    unpriced.length === 0 ||
    config.routeSettings.some((s) => s.insurancePercent != null || s.insuranceMinPaise != null)
  if (insures && !priced) out.push('insurance_unpriced')
  return out
}

export async function deliveryOverview(
  tx: StoreTx,
  storeId: string,
  providers: readonly ShippingProvider[],
): Promise<DeliveryOverview> {
  const config = await loadDeliveryConfig(tx, storeId)
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
  /**
   * The Options page's unsaved edits, priced instead of what is saved (its live checkout
   * preview): the layout and the options as edited. Nothing is written.
   */
  draft?:
    | { layout?: DeliveryLayout | undefined; options?: DeliveryOption[] | undefined }
    | undefined
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
  /** Answers cached by checkout (6 h fresh) stand in for live calls: the previews. */
  cache: HealthStore | null = null,
): Promise<TryPinResult> {
  const parsed = parsePincode(input.pincode)
  if (!parsed.ok) throw new Error('Enter a 6 digit PIN code.')
  const config = withDraft(await loadDeliveryConfig(tx, storeId), input.draft)
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
    providerSettings: settings.providers,
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
    cache: cache ? readOnly(cache) : null,
  })
  return {
    ...result,
    routes: routesFromAnswers(answers, config.routeSettings, weightGrams),
    stateCode,
    parcel,
  }
}

/** The saved config with the page's unsaved layout and options in place of the saved ones. */
function withDraft(saved: DeliveryConfig, draft: TryPinInput['draft']): DeliveryConfig {
  if (!draft) return saved
  const layout = draft.layout ?? saved.layout ?? 'fixed'
  return {
    ...saved,
    options: draft.options ?? saved.options,
    layout,
    version: `${saved.version}:draft`,
  }
}

/**
 * The cache without the breaker and health writes: what the admin asks must not count as a
 * checkout's call (a slow preview would otherwise trip the breaker shoppers depend on). Fresh
 * answers it gets are still saved, so the next shopper at that PIN is answered at once.
 */
const readOnly = (cache: HealthStore): HealthStore => ({
  get: (key) => cache.get(key),
  set: (key, value, ttl) => cache.set(key, value, ttl),
})

/**
 * Where the route list asks from: the store's origin to Delhi and to Bengaluru, a 500 g
 * Rs 1,000 parcel, COD asked too. Couriers have no "list my services" call (Shiprocket and
 * RapidShyp answer per lane), so two long lanes stand in for "every service the app offers".
 */
const CATALOGUE_LANES = ['110001', '560001'] as const
const CATALOGUE_PARCEL = { weightGrams: 500, valuePaise: 100_000 }

export type RouteCatalogue = {
  /** Every route the connected apps offer on the lanes, the cheapest answer per route kept. */
  routes: Route[]
  /** Each app's answer: an app that failed on every lane has no routes listed. */
  apps: Array<{ providerId: string; providerLabel: string; ok: boolean; error: string | null }>
  /** The couriers' own insurance rate by app id (RapidShyp, Shiprocket). */
  courierRates: Readonly<Record<string, CourierInsuranceRate>>
  lanes: readonly string[]
}

/** Two answers for one route (two lanes): the cheaper price, COD if either lane takes it. */
function mergeRoute(had: Route | undefined, next: Route): Route {
  if (!had) return next
  const cheaper =
    next.costPaise !== null && (had.costPaise === null || next.costPaise < had.costPaise)
  const base = cheaper ? next : had
  const cod =
    had.codAvailable === true || next.codAvailable === true
      ? true
      : (had.codAvailable ?? next.codAvailable)
  return { ...base, codAvailable: cod }
}

/**
 * The Routes page's list: every route (courier x app x service) the store's connected apps
 * offer, asked on `CATALOGUE_LANES` through the same 6 h answer cache checkout uses (so it costs
 * no courier call when an answer is cached), with the merchant's route settings applied.
 */
export async function deliveryRouteCatalogue(
  storeId: string,
  providers: readonly ShippingProvider[],
  settings: ShippingSettings,
  config: Pick<DeliveryConfig, 'routeSettings'>,
  cache: HealthStore | null,
): Promise<RouteCatalogue> {
  const origin = toShippingPolicy(settings).originPincode
  const perLane = await Promise.all(
    CATALOGUE_LANES.map((pin) =>
      gatherProviderAnswers(
        providers,
        { originPincode: origin, destinationPincode: pin, ...CATALOGUE_PARCEL, wantCod: true },
        {
          storeId,
          cache: cache ? readOnly(cache) : null,
          deadlineMs: ADMIN_DEADLINE_MS,
          providerSettings: settings.providers,
        },
      ),
    ),
  )
  const byKey = new Map<string, Route>()
  for (const answers of perLane) {
    const routes = routesFromAnswers(answers, config.routeSettings, CATALOGUE_PARCEL.weightGrams)
    for (const r of routes) byKey.set(r.key, mergeRoute(byKey.get(r.key), r))
  }
  const apps = new Map<string, RouteCatalogue['apps'][number]>()
  for (const a of perLane.flat()) {
    const had = apps.get(a.providerId)
    const ok = a.status === 'ok'
    if (!had || (!had.ok && ok)) {
      apps.set(a.providerId, {
        providerId: a.providerId,
        providerLabel: a.providerLabel,
        ok,
        error: ok ? null : a.error,
      })
    }
  }
  return {
    routes: [...byKey.values()].sort(
      (a, b) =>
        Number(a.channel !== 'direct') - Number(b.channel !== 'direct') ||
        a.providerLabel.localeCompare(b.providerLabel) ||
        a.carrier.localeCompare(b.carrier) ||
        a.key.localeCompare(b.key),
    ),
    apps: [...apps.values()],
    courierRates: COURIER_INSURANCE,
    lanes: CATALOGUE_LANES,
  }
}

export type ExpressShare = {
  /** Orders placed with a delivery option in the window (not cancelled, not test). */
  orders: number
  /** Those whose option is an Express-speed one. */
  express: number
  /** What those Express orders paid for shipping, on average; null with none. */
  averagePaise: number | null
  days: number
}

/** The Overview's "Shoppers picking Express": the last `days` of orders that chose an option. */
export async function deliveryExpressShare(
  tx: StoreTx,
  options: readonly Pick<DeliveryOption, 'id' | 'speed'>[],
  now: Date = new Date(),
  days = 30,
): Promise<ExpressShare> {
  const since = new Date(now.getTime() - days * 86_400_000)
  const express = options.filter((o) => o.speed === 'express').map((o) => o.id)
  const optionId = sql`(${order.shipping} -> 'delivery' ->> 'optionId')`
  const isExpress = express.length
    ? sql`${optionId} in (${sql.join(
        express.map((id) => sql`${id}`),
        sql`, `,
      )})`
    : sql`false`
  const [row] = await tx
    .select({
      orders: sql<number>`count(*)::int`,
      express: sql<number>`(count(*) filter (where ${isExpress}))::int`,
      average: sql<
        number | null
      >`(round(avg(${order.shippingPaise}) filter (where ${isExpress})))::int`,
    })
    .from(order)
    .where(
      and(
        gte(order.placedAt, since),
        ne(order.status, 'cancelled'),
        ne(order.status, 'draft'),
        sql`${order.isTest} = false`,
        sql`${optionId} is not null`,
      ),
    )
  return {
    orders: Number(row?.orders ?? 0),
    express: Number(row?.express ?? 0),
    averagePaise: row?.average == null ? null : Number(row.average),
    days,
  }
}
