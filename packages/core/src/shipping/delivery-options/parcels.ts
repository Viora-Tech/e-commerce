/** SOURCE OF TRUTH: delivery options for a cart that ships as several parcels — WHAT:
 * `resolveParcelDeliveries` runs the engine once per parcel (each from its own location, in its
 * own box, on its own courier answers) and adds the cards up per option / WHY: a cart split
 * across warehouses (order/routing.ts) is booked as one label per parcel, so checkout must charge
 * what those labels cost, not one parcel's price (#1546). Pure: no database, no network.
 *
 * Rules (owner, 11 Nov 2026):
 * - One parcel: exactly the single-parcel engine, nothing added.
 * - An option shows only when every parcel can carry it. A parcel whose couriers are down falls
 *   back the way a single parcel does (Standard at the Shipping rate, Express hidden), so a hidden
 *   option in any parcel hides it for the cart.
 * - Prices, list prices, courier cost, markup and insurance add up. The store's Shipping rate (a
 *   parcel on backup, or an option priced "from the Shipping rate") is the cart's rate: it is
 *   charged once, the highest of those parcels, never once per parcel; free stays free. Each
 *   parcel's insurance is still added on top of it (owner, 12 Nov: insurance is per parcel).
 * - Free-above and insure-above read the whole order's value (`orderValuePaise`).
 * - Dates: the last parcel to arrive. Any parcel on backup puts the option on backup (no route
 *   saved; booking uses the courier rule). Sub-choices: the couriers every parcel offers, summed.
 */
import { resolveDeliveryOptions } from './resolve'
import type {
  DeliveryResolveResult,
  PricedRoute,
  ResolvedOption,
  ResolveInput,
} from './resolve-types'
import type { ProviderAnswer } from './routes'

/** Split `valuePaise` in proportion to `weights`, the rounding left on the last share. */
export function shareValue(valuePaise: number, weights: readonly number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) return weights.map((_, i) => (i === 0 ? valuePaise : 0))
  const shares = weights.map((w) => Math.floor((valuePaise * w) / total))
  const given = shares.reduce((s, v) => s + v, 0)
  shares[shares.length - 1] = (shares[shares.length - 1] ?? 0) + valuePaise - given
  return shares
}

/** One parcel of the cart, as the engine prices it. */
export type DeliveryParcelInput = {
  cart: ResolveInput['cart']
  answers: readonly ProviderAnswer[]
}

const later = (a: string | null, b: string | null): string | null =>
  a === null || b === null ? null : a > b ? a : b

const roundUpToTen = (paise: number): number => Math.ceil(paise / 1000) * 1000

/**
 * Sum, with the parcels priced from the Shipping rate counted once (their highest rate), plus
 * every one of those parcels' insurance (`insurances`, already inside each parcel's price), so a
 * second parcel's insurance is never dropped. A free parcel (₹0: free Shipping rate or free-above)
 * adds nothing: free stays free. With insurance the total is rounded up to ₹10, as one parcel's.
 */
function addUp(
  values: readonly number[],
  fromZone: readonly boolean[],
  insurances: readonly number[],
): number {
  let own = 0
  let rate = 0
  let insured = 0
  let charged = false
  values.forEach((v, i) => {
    if (!fromZone[i]) own += v
    else if (v > 0) {
      const ins = Math.min(insurances[i] ?? 0, v)
      rate = Math.max(rate, v - ins)
      insured += ins
      charged = true
    }
  })
  if (!charged) return own
  return own + (insured > 0 ? roundUpToTen(rate + insured) : rate)
}

function addRoutes(routes: readonly PricedRoute[], fromZone: readonly boolean[]): PricedRoute {
  const first = routes[0] as PricedRoute
  const insurances = routes.map((r) => r.insurancePaise)
  const insured = insurances.map((i) => i ?? 0)
  return {
    route: first.route,
    pricePaise: addUp(
      routes.map((r) => r.pricePaise),
      fromZone,
      insured,
    ),
    listPricePaise: addUp(
      routes.map((r) => r.listPricePaise),
      fromZone,
      insured,
    ),
    courierCostPaise: routes.reduce((s, r) => s + r.courierCostPaise, 0),
    markupPaise: routes.reduce((s, r) => s + r.markupPaise, 0),
    insurancePaise: insurances.some((i) => i === null)
      ? null
      : insurances.reduce<number>((s, i) => s + (i ?? 0), 0),
    insured: routes.every((r) => r.insured),
    earliest: routes.reduce<string | null>((d, r) => later(d, r.earliest), first.earliest),
    latest: routes.reduce<string | null>((d, r) => later(d, r.latest), first.latest),
    etaEstimated: routes.some((r) => r.etaEstimated),
  }
}

/** One option's card for the whole cart, from its card in every parcel. */
function addUpOption(parts: readonly ResolvedOption[], priceFromZone: boolean): ResolvedOption {
  const first = parts[0] as ResolvedOption
  if (parts.length === 1) return first
  const fromZone = parts.map((p) => priceFromZone || p.source === 'backup')
  const onBackup = parts.some((p) => p.source === 'backup')
  const picks = parts.map((p) => p.pick)
  const pick =
    !onBackup && picks.every((p): p is PricedRoute => p !== null)
      ? addRoutes(picks, fromZone)
      : null
  // A sub-choice only when every parcel offers that courier.
  const choices = pick
    ? first.choices.flatMap((c) => {
        const each = parts.map((p) => p.choices.find((x) => x.route.key === c.route.key))
        return each.every((x): x is PricedRoute => x !== undefined)
          ? [addRoutes(each, fromZone)]
          : []
      })
    : []
  const cods = parts.map((p) => p.cod)
  const cod =
    pick && cods.every((c): c is PricedRoute => c !== null) ? addRoutes(cods, fromZone) : null
  const insurances = parts.map((p) => p.insurance.pricePaise).filter((v): v is number => v !== null)
  const backup = parts.find((p) => p.source === 'backup')
  // Insurance inside each parcel's own price (a backup parcel has none).
  const partInsurance = parts.map((p) => p.pick?.insurancePaise ?? 0)
  return {
    ...first,
    title: pick ? first.title : first.name,
    source: onBackup ? 'backup' : parts.every((p) => p.source === 'live') ? 'live' : 'cache',
    pick,
    pickedBy: pick ? first.pickedBy : 'backup',
    why: pick ? first.why : { kind: 'backup' },
    choices: choices.length > 1 ? choices : [],
    layout: choices.length > 1 ? first.layout : 'one',
    pricePaise:
      pick?.pricePaise ??
      addUp(
        parts.map((p) => p.pricePaise),
        fromZone,
        partInsurance,
      ),
    listPricePaise:
      pick?.listPricePaise ??
      addUp(
        parts.map((p) => p.listPricePaise),
        fromZone,
        partInsurance,
      ),
    earliest: parts.reduce<string | null>((d, p) => later(d, p.earliest), first.earliest),
    latest: parts.reduce<string | null>((d, p) => later(d, p.latest), first.latest),
    etaEstimated: parts.some((p) => p.etaEstimated),
    codAllowed: parts.every((p) => p.codAllowed) && (onBackup || cod !== null),
    cod: onBackup ? null : cod,
    insurance: {
      offered: parts.some((p) => p.insurance.offered),
      required: parts.some((p) => p.insurance.required),
      on: parts.some((p) => p.insurance.on),
      pricePaise: insurances.length ? insurances.reduce((s, v) => s + v, 0) : null,
    },
    backupRate: backup?.backupRate ?? null,
  }
}

/**
 * The cards for a cart shipping as `parcels`, worth `orderValuePaise` in all. One parcel is the
 * plain engine. Every parcel's answers are kept in the trace's provider list.
 */
export function resolveParcelDeliveries(
  base: Omit<ResolveInput, 'cart' | 'answers' | 'orderValuePaise'>,
  parcels: readonly DeliveryParcelInput[],
  orderValuePaise: number,
): DeliveryResolveResult {
  if (parcels.length <= 1) {
    const only = parcels[0]
    return resolveDeliveryOptions({
      ...base,
      cart: only?.cart ?? { valuePaise: orderValuePaise, weightGrams: 0, items: [] },
      answers: only?.answers ?? [],
    })
  }
  const results = parcels.map((p) =>
    resolveDeliveryOptions({ ...base, cart: p.cart, answers: p.answers, orderValuePaise }),
  )
  const [first, ...rest] = results as [DeliveryResolveResult, ...DeliveryResolveResult[]]
  const options = first.options.flatMap((o) => {
    const parts = [o, ...rest.map((r) => r.options.find((x) => x.optionId === o.optionId))]
    if (parts.some((p) => p === undefined)) return []
    const saved = base.config.options.find((c) => c.id === o.optionId)
    return [addUpOption(parts as ResolvedOption[], saved?.price.source === 'zone')]
  })
  const status = options.length
    ? 'options'
    : results.some((r) => r.status === 'unserviceable')
      ? 'unserviceable'
      : 'none'
  return {
    status,
    options,
    parcels: results,
    trace: {
      options: first.trace.options,
      providers: results.flatMap((r) => r.trace.providers),
    },
  }
}
