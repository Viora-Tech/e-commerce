/** SOURCE OF TRUTH: the delivery options engine's input and output shapes — WHAT: what `resolveDeliveryOptions` takes (config, cart, courier answers, zone rates, calendar) and returns (cards, picks, prices, the trace) / WHY: checkout, place order, booking and Try a PIN all read these. Pure types. */
import type { DispatchPolicy } from '@commerce/shipping'
import type { ShippingRateOption } from '../rates'
import type { DeliveryConfig, DeliveryOption } from './config'
import type { ProviderAnswer, Route } from './routes'
import type { CartItemFacts } from './rules'

export type ZoneQuote =
  | { kind: 'not_configured' }
  | { kind: 'no_rates' }
  | { kind: 'rates'; options: ShippingRateOption[] }

export type ResolveInput = {
  config: DeliveryConfig
  cart: { valuePaise: number; weightGrams: number; items: readonly CartItemFacts[] }
  answers: readonly ProviderAnswer[]
  /** The store's zone rates for this address: the `zone` price and the Standard backup. */
  zone: ZoneQuote
  policy: DispatchPolicy & {
    defaultMinTransitDays: number
    defaultMaxTransitDays: number
    codAllowed: boolean
  }
  now: Date
  /** The shopper unticked "Insure this shipment". Never overrides a rule that requires it. */
  declineInsurance?: boolean | undefined
}

/** Why a route did not back an option. */
export type DropReason =
  | 'not_allowed'
  | 'wrong_speed'
  | 'rule'
  | 'disabled'
  | 'not_serviceable'
  | 'no_price'
  | 'no_insurance'
  | 'no_cod'
  | 'over_max_eta'

export type RouteSummary = Pick<
  Route,
  | 'key'
  | 'providerId'
  | 'providerLabel'
  | 'channel'
  | 'carrierKey'
  | 'carrier'
  | 'showCarrier'
  | 'serviceId'
  | 'serviceLabel'
  | 'speed'
  | 'source'
>

export type PricedRoute = {
  route: RouteSummary
  /** What the shopper pays for shipping on this route. */
  pricePaise: number
  /** Before free-above: struck through when the option is free. */
  listPricePaise: number
  /** What the route quoted (before markup and insurance), for margin. */
  courierCostPaise: number
  markupPaise: number
  /** Insurance charged; null when the route's insurance rate is unknown (charged as ₹0). */
  insurancePaise: number | null
  insured: boolean
  earliest: string | null
  latest: string | null
  /** True when the dates come from the store's usual transit days, not the courier. */
  etaEstimated: boolean
}

export type WhyPicked =
  | { kind: 'cheapest' }
  | { kind: 'fastest' }
  | { kind: 'prefer_direct'; withinPaise: number }
  | { kind: 'rule_default'; ruleId: string; ruleName: string }
  | { kind: 'backup' }

export type ResolvedOption = {
  optionId: string
  name: string
  description: string | null
  /** "Express · Blue Dart"; just the option's name on backup. */
  title: string
  speed: DeliveryOption['speed']
  source: 'live' | 'cache' | 'backup'
  /** The route the card shows; null on backup (zone rate, no route saved). */
  pick: PricedRoute | null
  pickedBy: 'strategy' | `rule:${string}` | 'backup'
  why: WhyPicked
  /** Sub-choices when a rule allows alternatives: the pick first. Empty: no choice. */
  choices: PricedRoute[]
  pricePaise: number
  listPricePaise: number
  earliest: string | null
  latest: string | null
  etaEstimated: boolean
  /** Express (and any prepaid-only option) refuses cash on delivery. */
  codAllowed: boolean
  /** Standard picked again with "COD needed": what the order books and charges on COD. */
  cod: PricedRoute | null
  insurance: {
    /** Show the checkbox (offered and not required by a rule). */
    offered: boolean
    required: boolean
    on: boolean
    /** Insurance in the price; null when the route's rate is not filled in. */
    pricePaise: number | null
  }
  /** On backup, the zone rate charged. */
  backupRate: ShippingRateOption | null
}

export type TraceRoute = {
  key: string
  carrier: string
  providerLabel: string
  channel: Route['channel']
  serviceLabel: string
  speed: Route['speed']
  costPaise: number | null
  insurancePaise: number | null
  latest: string | null
  etaEstimated: boolean
  codAvailable: boolean | null
  insures: boolean
  source: Route['source']
  ms: number | null
  dropped: DropReason | null
}

export type OptionTrace = {
  optionId: string
  name: string
  rulesApplied: Array<{ id: string; name: string }>
  rulesOverruled: Array<{ id: string; name: string }>
  routes: TraceRoute[]
  winner: string | null
  why: WhyPicked | null
  /** Shown as "hidden: …" in Try a PIN. */
  hidden: 'no_route' | 'couriers_down' | 'no_zone_rate' | 'disabled' | null
}

export type DeliveryResolveResult = {
  /** `unserviceable`: every route truly said no. `none`: nothing to show (use zone rates). */
  status: 'options' | 'unserviceable' | 'none'
  options: ResolvedOption[]
  trace: {
    options: OptionTrace[]
    providers: Array<
      Pick<
        ProviderAnswer,
        'providerId' | 'providerLabel' | 'status' | 'source' | 'ms' | 'error' | 'serviceable'
      >
    >
  }
}
