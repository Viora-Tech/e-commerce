/** SOURCE OF TRUTH: the delivery options engine — WHAT: `resolveDeliveryOptions(input)` turns the
 * store's options, its product route rules and the routes the connected apps answered for one
 * PIN code into the cards checkout shows (option, courier, dates, price, insurance, COD), with
 * a trace of every route's quote, why each was dropped and why the winner won / WHY: checkout,
 * `placeOrder` (from the quote snapshot) and the admin's Try a PIN must compute the same answer.
 * Pure: no database, no network, the clock is passed in.
 */
import type { DeliveryOption } from './config'
import { courierList } from './courier-list'
import { optionCardTitle } from './labels'
import { alternativesFor, optionAllows, pickFor } from './pick'
import { cartProtect, cheapestZoneRate, datesFor } from './price'
import type {
  DeliveryResolveResult,
  DropReason,
  OptionTrace,
  PricedRoute,
  ResolvedOption,
  ResolveInput,
  TraceRoute,
} from './resolve-types'
import { insurancePrice, type Route, routesFromAnswers } from './routes'
import { cartRulePrices, type RulePriceContext } from './rule-price'
import { matchRules, poolAllows, rulePool } from './rules'

function traceRoute(
  route: Route,
  dropped: DropReason | null,
  priced: PricedRoute | undefined,
  option: DeliveryOption,
  input: ResolveInput,
): TraceRoute {
  const dated = priced ?? null
  const d = dated ? null : datesFor(route, option, input)
  return {
    key: route.key,
    carrier: route.carrier,
    providerLabel: route.providerLabel,
    channel: route.channel,
    serviceLabel: route.serviceLabel,
    speed: route.speed,
    costPaise: route.costPaise,
    insurancePaise:
      priced?.insurancePaise ?? insurancePrice(route, input.cart.valuePaise, cartProtect(input)),
    latest: dated?.latest ?? d?.latest ?? null,
    etaEstimated: dated?.etaEstimated ?? d?.estimated ?? true,
    codAvailable: route.codAvailable,
    insures: route.insures,
    source: route.source,
    ms: route.ms,
    dropped,
  }
}

const asRef = (r: { id: string; name: string }) => ({ id: r.id, name: r.name })

/** The shopper's tick, else the option's default. */
function wantsInsurance(option: DeliveryOption, input: ResolveInput): boolean {
  if (input.insure !== undefined) return input.insure
  if (input.declineInsurance === true) return false
  return option.insurance.default === 'on'
}

/** Whether `a` arrives strictly earlier than `b` (latest date, then earliest). */
function arrivesEarlier(a: ResolvedOption, b: ResolvedOption): boolean {
  if (!a.latest || !b.latest) return true
  if (a.latest !== b.latest) return a.latest < b.latest
  return !!a.earliest && !!b.earliest && a.earliest < b.earliest
}

/**
 * `compareSpeeds: false` leaves Express in even when it is not faster: a split cart's parcels
 * are resolved one by one and compared once added up (`resolveParcelDeliveries`).
 */
export function resolveDeliveryOptions(
  input: ResolveInput,
  opts: { compareSpeeds?: boolean } = {},
): DeliveryResolveResult {
  const { config, cart, answers } = input
  const allRoutes = routesFromAnswers(answers, config.routeSettings, cart.weightGrams)
  const anyFailed = answers.length === 0 || answers.some((a) => a.status === 'failed')
  const ruleNames = new Map(config.rules.map((r) => [r.id, r.name]))
  const options: ResolvedOption[] = []
  const traces: OptionTrace[] = []

  const sorted = [...config.options].sort((a, b) => a.position - b.position)
  // The courier list layout: the first enabled option alone, as a list of couriers.
  const listOptionId = config.layout === 'list' ? (sorted.find((o) => o.enabled)?.id ?? null) : null
  /* A product rule's price (Free, Fixed ₹, free above) is the price of the courier list's option,
     else of the first enabled Standard option; Express and any other option keep their own. */
  const priceOptionId =
    listOptionId ?? sorted.find((o) => o.enabled && o.speed === 'standard')?.id ?? null
  for (const saved of sorted) {
    const option: DeliveryOption =
      saved.id === listOptionId && saved.couriers.show !== 'list'
        ? { ...saved, couriers: { ...saved.couriers, show: 'list' } }
        : saved
    const base: OptionTrace = {
      optionId: option.id,
      name: option.name,
      rulesApplied: [],
      rulesOverruled: [],
      routes: [],
      winner: null,
      why: null,
      hidden: null,
    }
    if (!option.enabled) {
      traces.push({ ...base, hidden: 'disabled' })
      continue
    }
    if (listOptionId !== null && option.id !== listOptionId) {
      traces.push({ ...base, hidden: 'list_layout' })
      continue
    }
    // The option hides every courier name: its cards show only the delivery promise (#1521).
    const routes = option.couriers.showNames
      ? allRoutes
      : allRoutes.map((r) => ({ ...r, showCarrier: false }))
    const listed = option.couriers.show === 'list'
    const candidates = routes.filter(
      (r) => optionAllows(option, r) && (listed || r.speed === option.speed),
    )
    const match = matchRules(config.rules, option.id, cart.items)
    const pool = rulePool(match.winners, candidates, match.outranked)
    const ins = option.insurance
    const offered =
      ins.onlyAbovePaise == null || (input.orderValuePaise ?? cart.valuePaise) >= ins.onlyAbovePaise
    const required = pool.insuranceRequired
    const insured = required || (offered && wantsInsurance(option, input))
    const codAllowed =
      option.speed === 'standard' && option.cod.mode === 'allowed' && input.policy.codAllowed

    const prices =
      option.id === priceOptionId ? cartRulePrices(config.rules, option.id, cart.items) : null
    const rulePrice: RulePriceContext | null = prices
      ? { prices, orderValuePaise: input.orderValuePaise ?? cart.valuePaise }
      : null
    const pickOf = (need: { insured: boolean; cod: boolean }) =>
      pickFor(routes, option, pool, input, { ...need, required }, ruleNames, rulePrice)
    const prepaid = pickOf({ insured, cod: false })
    const pricedByKey = new Map(prepaid.fits.map((c) => [c.route.key, c.priced]))
    const won = prepaid.picked?.winner
    if (won) pricedByKey.set(won.route.key, won.priced)
    const trace: OptionTrace = {
      ...base,
      rulesApplied: pool.applied.map(asRef),
      rulesOverruled: pool.overruled.map(asRef),
      routes: routes.map((r) =>
        traceRoute(r, prepaid.dropped.get(r.key) ?? null, pricedByKey.get(r.key), option, input),
      ),
    }

    if (!prepaid.picked) {
      /* Nothing fits. "Down" means none of this option's routes could even be asked: a
         courier failed and no answered route is serviceable. Express then hides; Standard
         falls back to the store's zone rate with no route saved. */
      const down = anyFailed && !candidates.some((r) => r.serviceable && poolAllows(pool, r))
      const backup =
        down && option.speed === 'standard' ? backupOption(option, input, codAllowed) : null
      if (backup) {
        options.push(backup)
        traces.push({ ...trace, why: { kind: 'backup' } })
      } else {
        traces.push({
          ...trace,
          hidden: down
            ? option.speed === 'standard'
              ? 'no_zone_rate'
              : 'couriers_down'
            : 'no_route',
        })
      }
      continue
    }

    const { winner, why } = prepaid.picked
    // A forced route carries the parcel alone: no alternatives, no other courier cards.
    const alternatives = prepaid.forced
      ? []
      : alternativesFor(prepaid.fits, pool.alternatives, option, winner, rulePrice !== null)
    const codPick = codAllowed ? pickOf({ insured, cod: true }).picked : null
    const pick = winner.priced
    const listChoices =
      listed && !prepaid.forced
        ? courierList(
            prepaid.fits,
            winner,
            option,
            why.kind === 'rule_default',
            rulePrice !== null,
          )
        : []
    /* The tick: priced both ways, so "+₹X" is what ticking really adds after rounding. A route
       with no insurance rate prices insurance at ₹0, and then no tick shows. */
    const flipped =
      offered && !required
        ? pickOf({ insured: !insured, cod: false }).picked
        : null
    const insuredPick = insured ? pick : (flipped?.winner.priced ?? null)
    const insurancePaise = insuredPick ? insuredPick.insurancePaise : null
    const extra = flipped
      ? Math.max(
          0,
          insured
            ? pick.pricePaise - flipped.winner.priced.pricePaise
            : flipped.winner.priced.pricePaise - pick.pricePaise,
        )
      : null
    // No tick when ticking changes nothing the shopper pays (a free rule covers the insurance).
    const tick =
      flipped !== null && insuredPick !== null && (insurancePaise ?? 0) > 0 && (extra ?? 0) > 0
    options.push({
      optionId: option.id,
      name: option.name,
      description: option.description ?? null,
      title: optionCardTitle(option, pick.route, listChoices.length > 0),
      speed: option.speed,
      source: winner.route.source,
      pick,
      pickedBy: why.kind === 'rule_default' ? `rule:${why.ruleId}` : 'strategy',
      why,
      choices: listChoices.length
        ? listChoices
        : alternatives.length
          ? [pick, ...alternatives]
          : [],
      layout: listChoices.length ? 'list' : 'one',
      ...(listChoices.length && option.couriers.extra === 'full' ? { fullPrices: true } : {}),
      pricePaise: pick.pricePaise,
      listPricePaise: pick.listPricePaise,
      earliest: pick.earliest,
      latest: pick.latest,
      etaEstimated: pick.etaEstimated,
      codAllowed: codAllowed && codPick !== null,
      cod: codPick?.winner.priced ?? null,
      insurance: {
        offered: tick,
        required,
        on: insured,
        pricePaise: insured ? pick.insurancePaise : insurancePaise,
        extraPaise: tick ? extra : null,
      },
      backupRate: null,
    })
    traces.push({ ...trace, winner: winner.route.key, why })
  }

  if (opts.compareSpeeds !== false) hideExpressNotFaster(options, traces, listOptionId !== null)

  const providers = answers.map((a) => ({
    providerId: a.providerId,
    providerLabel: a.providerLabel,
    status: a.status,
    source: a.source,
    ms: a.ms,
    error: a.error,
    serviceable: a.serviceable,
  }))
  const allSaidNo =
    answers.length > 0 && answers.every((a) => a.status === 'ok' && a.serviceable === false)
  const status = options.length ? 'options' : allSaidNo ? 'unserviceable' : 'none'
  return { status, options, trace: { options: traces, providers } }
}

/**
 * Fixed options: an Express card whose pick does not arrive earlier than Standard's pick is
 * hidden (it would be the same promise at a higher price, e.g. PIN 131001 with a mouse, #1781).
 * The trace says `not_faster`. Backup cards and the list layout are left alone.
 */
export function hideExpressNotFaster(
  options: ResolvedOption[],
  traces: OptionTrace[],
  listLayout: boolean,
): void {
  if (listLayout) return
  const standard = options.find((o) => o.speed === 'standard' && o.pick !== null)
  if (!standard) return
  for (const o of [...options]) {
    if (o.speed !== 'express' || o.pick === null || o.layout === 'list') continue
    if (arrivesEarlier(o, standard)) continue
    options.splice(options.indexOf(o), 1)
    const t = traces.find((x) => x.optionId === o.optionId)
    if (t) t.hidden = 'not_faster'
  }
}

/** Standard when couriers are down: the store's zone rate and usual transit days. */
function backupOption(
  option: DeliveryOption,
  input: ResolveInput,
  codAllowed: boolean,
): ResolvedOption | null {
  if (input.zone.kind === 'no_rates') return null
  const rate = cheapestZoneRate(input.zone)
  const price = rate?.pricePaise ?? 0
  const dated = datesFor(null, option, input)
  return {
    optionId: option.id,
    name: option.name,
    description: option.description ?? null,
    title: option.name,
    speed: option.speed,
    source: 'backup',
    pick: null,
    pickedBy: 'backup',
    why: { kind: 'backup' },
    choices: [],
    layout: 'one',
    pricePaise: price,
    listPricePaise: rate?.listPricePaise ?? price,
    earliest: dated.earliest,
    latest: dated.latest,
    etaEstimated: true,
    codAllowed,
    cod: null,
    insurance: { offered: false, required: false, on: false, pricePaise: null, extraPaise: null },
    backupRate: rate,
  }
}

/** The priced route a shopper's choice means: a sub-choice by key, else the option's pick. */
export function chosenRoute(
  option: ResolvedOption,
  routeKey: string | null | undefined,
  payment: 'prepaid' | 'cod',
): PricedRoute | null {
  // A courier list: paying on delivery keeps the picked courier at its own COD price.
  if (payment === 'cod' && option.layout === 'list') {
    const card =
      (routeKey && option.choices.find((c) => c.route.key === routeKey)) || option.choices[0]
    if (card && card.codPricePaise != null) {
      const cod = card.codPricePaise
      return { ...card, pricePaise: cod, listPricePaise: Math.max(card.listPricePaise, cod) }
    }
  }
  if (payment === 'cod' && option.cod) return option.cod
  if (routeKey) {
    const sub = option.choices.find((c) => c.route.key === routeKey)
    if (sub) return sub
  }
  return option.pick
}
