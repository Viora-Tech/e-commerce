/** SOURCE OF TRUTH: the Delivery options app's settings shapes — WHAT: zod schemas for a
 * delivery option (Standard, Express), a product or collection route rule and a per-route
 * setting (insures, insurance rate, cost card), plus the route selector both use / WHY: the
 * admin forms, the API, the database rows and the pure engine (`resolve.ts`) must agree on one
 * shape. Pure: no database, safe for the browser (`@commerce/core/delivery-options`).
 * Design: docs/superpowers/specs/2026-10-29-delivery-options-design.md.
 */
import { z } from 'zod'
import type { ProtectCard } from './protect'
import { PRICE_ROUNDINGS } from './rounding'

export { PRICE_ROUNDINGS, type PriceRounding, roundPrice } from './rounding'

export const DELIVERY_OPTIONS_APP_ID = 'delivery-options'

/** No same-day or next-day in v1. */
export const DELIVERY_SPEEDS = ['standard', 'express'] as const
export type DeliverySpeed = (typeof DELIVERY_SPEEDS)[number]

export const DELIVERY_STRATEGIES = ['cheapest', 'fastest'] as const
export type DeliveryStrategy = (typeof DELIVERY_STRATEGIES)[number]

const paise = z.number().int().min(0).max(10_000_000)
const percent = z.number().min(0).max(100)
const days = z.number().int().min(0).max(60)

/**
 * Which routes a setting or rule means. `carrier` is the normalised carrier key
 * (`delhivery`, `bluedart`, see `routes.ts`); `channel` is `direct` (the courier's own app),
 * `aggregator` (any of them), an aggregator's app id (`shiprocket`), or `any`; `speed` narrows
 * to Surface or Express/Air services; `serviceId` pins one exact service of one app.
 */
export const RouteSelectorSchema = z.object({
  carrier: z.string().trim().min(1).max(40),
  channel: z.string().trim().min(1).max(40).default('any'),
  speed: z.enum(['any', ...DELIVERY_SPEEDS]).default('any'),
  serviceId: z.string().trim().max(64).nullish(),
})
export type RouteSelector = z.infer<typeof RouteSelectorSchema>

export const OptionRoutesSchema = z.discriminatedUnion('mode', [
  /** Any connected route of the option's speed. */
  z.object({ mode: z.literal('any') }),
  z.object({ mode: z.literal('allow'), selectors: z.array(RouteSelectorSchema).min(1).max(20) }),
  z.object({ mode: z.literal('exclude'), selectors: z.array(RouteSelectorSchema).min(1).max(20) }),
])
export type OptionRoutes = z.infer<typeof OptionRoutesSchema>

export const OPTION_PRICE_SOURCES = ['route', 'zone', 'free'] as const
export type OptionPriceSource = (typeof OPTION_PRICE_SOURCES)[number]

export const OptionPriceSchema = z.object({
  /**
   * `route`: route cost + markup + insurance, rounded up (`rounding`). `zone`: Shipping rates.
   * `free`: the option's own card (the base card of a courier list) costs the shopper ₹0, the
   * store pays the courier; other couriers in a list still show "+₹ difference", and insurance
   * the shopper ticks is still charged.
   */
  source: z.enum(OPTION_PRICE_SOURCES).default('route'),
  markupPaise: paise.default(0),
  markupPercent: percent.default(0),
  freeAbovePaise: paise.nullish(),
  minPaise: paise.nullish(),
  maxPaise: paise.nullish(),
  /**
   * How a price the engine makes is rounded up (`rounding.ts`): `nine` ₹43 → ₹49, `fifty`
   * ₹58 → ₹99, `ten` ₹43 → ₹50 (the rule before 20 Nov 2026, so saved options keep it), `off`
   * whole rupees. A Shipping rate the merchant typed is never rounded.
   */
  rounding: z.enum(PRICE_ROUNDINGS).default('ten'),
})

export const OptionInsuranceSchema = z.object({
  /** Whether checkout's "Insure this parcel" tick starts ticked. Off still offers it. */
  default: z.enum(['on', 'off']).default('off'),
  /** Offered only from this order value up; null: every order. */
  onlyAbovePaise: paise.nullish(),
})

export const OptionEtaSchema = z.object({
  source: z.enum(['route', 'fixed']).default('route'),
  fixedMinDays: days.nullish(),
  fixedMaxDays: days.nullish(),
  /** Days added to the latest date, on top of the courier's own. */
  bufferDays: days.default(0),
  /** Days the warehouse needs before the parcel leaves, added to both ends. */
  processingDays: days.default(0),
  /** A route promising later than this many transit days is dropped; null: no limit. */
  maxDays: days.nullish(),
})

/**
 * How the option shows its couriers at checkout. `one`: one card, the strategy's pick. `list`:
 * every allowed courier (any speed) as its own card, like the Delivery promise Shopify app: the
 * pick at the option's price, the rest at that price plus the difference in courier cost.
 */
export const OptionCouriersSchema = z.object({
  show: z.enum(['one', 'list']).default('one'),
  /**
   * Cards at most, the pick included; null: every courier that fits (the default from 20 Nov
   * 2026). Options saved earlier keep their number (2 to 8 then).
   */
  max: z.number().int().min(2).max(20).nullable().default(null),
  /** +₹37 shows as +₹39. */
  roundTo9: z.boolean().default(true),
  /**
   * Drop a courier another one beats on both price and date, but never below three cards when
   * three couriers can deliver (`MIN_LIST_CARDS` in courier-list.ts).
   */
  hideSlowerDearer: z.boolean().default(true),
  /**
   * Off, checkout shows only the delivery promise ("Standard", the date): no courier name or
   * logo on any of this option's cards, whatever each courier's own setting says (#1521).
   */
  showNames: z.boolean().default(true),
  /**
   * The couriers this option may use, as `courierId`s (`delhivery:standard`); null: every
   * connected courier (as before). Set from the Options page's courier list, where a courier
   * the apps start offering later is off until the merchant turns it on.
   */
  allow: z.array(z.string().trim().min(1).max(80)).max(100).nullish(),
  /** Every `courierId` the merchant has seen in that list; one not here is tagged New. */
  known: z.array(z.string().trim().min(1).max(80)).max(200).default([]),
  /** `difference`: a list card costs the pick's price plus what it costs the store more;
   *  `none`: every card at the pick's price. */
  extra: z.enum(['difference', 'none']).default('difference'),
})
export type OptionCouriers = z.infer<typeof OptionCouriersSchema>

export const OPTION_COD_FEES = ['included', 'separate'] as const
export type OptionCodFee = (typeof OPTION_COD_FEES)[number]

export const OptionCodSchema = z.object({
  /** Express is always prepaid only, whatever is saved here. */
  mode: z.enum(['prepaid_only', 'allowed']).default('allowed'),
  /**
   * What the courier's own cash on delivery charge does at checkout (`codExtraPaise`):
   * `included` (as before 20 Nov 2026): the delivery price on COD is higher by it;
   * `separate`: the delivery price stays the prepaid one and the charge shows as its own
   * "Cash on delivery fee" line (the rate's `codSurchargePaise`, which takes the place of the
   * store's COD fee from Settings → Payments, as a Shipping rate's own COD fee does).
   */
  fee: z.enum(OPTION_COD_FEES).default('included'),
})

export const DeliveryOptionInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(160).nullish(),
  speed: z.enum(DELIVERY_SPEEDS).default('standard'),
  routes: OptionRoutesSchema.default({ mode: 'any' }),
  strategy: z.enum(DELIVERY_STRATEGIES).default('cheapest'),
  /** Take a direct route when it costs at most this much more than the aggregator winner. */
  preferDirectWithinPaise: paise.nullish(),
  /**
   * A carrier key (`delhivery`): among routes at the same shopper price and the same arrival
   * date, this carrier wins (#1520). The earlier arrival always comes first.
   */
  preferCarrier: z.string().trim().min(1).max(40).nullish(),
  price: OptionPriceSchema.default(OptionPriceSchema.parse({})),
  insurance: OptionInsuranceSchema.default(OptionInsuranceSchema.parse({})),
  eta: OptionEtaSchema.default(OptionEtaSchema.parse({})),
  cod: OptionCodSchema.default(OptionCodSchema.parse({})),
  couriers: OptionCouriersSchema.default(OptionCouriersSchema.parse({})),
  enabled: z.boolean().default(true),
})
export type DeliveryOptionInput = z.infer<typeof DeliveryOptionInputSchema>
export type DeliveryOption = DeliveryOptionInput & { id: string; position: number }

/**
 * What a rule matches. `all`: every product (`values` is `[]`). When rules of different kinds
 * match one product, the most specific wins (`products` > `collections`/`tags`/`types` > `all`,
 * `RULE_SPECIFICITY` in rules.ts); rules of the same kind intersect as before.
 */
/**
 * What a rule's products cost the shopper on the first (Recommended) courier, owner 20 Nov
 * 2026. `option`: the option's own price (as before). `free`: ₹0. `fixed`: `fixedPaise`.
 * `freeAbovePaise`: ₹0 once the order value is at least this. Other couriers cost that price
 * plus what they cost the store more (`courierList`). Applies to the first enabled Standard
 * option (or the courier list's option); Express keeps its own price. A cart whose products
 * have different rule prices pays the highest (`rule-price.ts`).
 */
export const RULE_PRICE_MODES = ['option', 'free', 'fixed'] as const
export type RulePriceMode = (typeof RULE_PRICE_MODES)[number]

export const RulePriceSchema = z.object({
  mode: z.enum(RULE_PRICE_MODES).default('option'),
  fixedPaise: paise.nullish(),
  freeAbovePaise: paise.nullish(),
})
export type RulePrice = z.infer<typeof RulePriceSchema>

export const RULE_TARGET_KINDS = ['products', 'collections', 'tags', 'types', 'all'] as const
export type RuleTargetKind = (typeof RULE_TARGET_KINDS)[number]

export const RouteRuleInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    target: z.object({
      kind: z.enum(RULE_TARGET_KINDS),
      /** Product or collection ids, or tag / product type values; `[]` for `all`. */
      values: z.array(z.string().trim().min(1).max(120)).max(500),
    }),
    /** `all`, or the ids of the options it applies to. */
    optionIds: z
      .union([z.literal('all'), z.array(z.string().min(1)).min(1).max(20)])
      .default('all'),
    routes: z.array(RouteSelectorSchema).min(1).max(20),
    defaultRoute: RouteSelectorSchema.nullish(),
    /**
     * On, and `defaultRoute` serves the PIN code: that route carries the parcel for every
     * option the rule applies to, even one of another speed ("ship mice by Air at the
     * Standard price"). The shopper pays the option's normal price; the store covers the
     * difference, which shows in the order's shipping margin. Booking uses that route.
     */
    forceRoute: z.boolean().default(false),
    alternatives: z.array(RouteSelectorSchema).max(10).default([]),
    insurance: z.enum(['follow_option', 'required']).default('follow_option'),
    /** Omitted (every rule saved before 20 Nov 2026): the option's own price. */
    price: RulePriceSchema.default({ mode: 'option' }),
    enabled: z.boolean().default(true),
  })
  .refine((r) => r.target.kind === 'all' || r.target.values.length > 0, {
    path: ['target', 'values'],
    message: 'Pick at least one',
  })
  .refine((r) => r.price.mode !== 'fixed' || r.price.fixedPaise != null, {
    path: ['price', 'fixedPaise'],
    message: 'Type the price',
  })
export type RouteRuleInput = z.infer<typeof RouteRuleInputSchema>
export type RouteRule = RouteRuleInput & { id: string; position: number }

export const CostCardSchema = z.object({
  /** First 500 g, prepaid. */
  firstHalfKgPaise: paise,
  /** Each further 500 g. */
  extraHalfKgPaise: paise.default(0),
  /** Added for cash on delivery. */
  codFeePaise: paise.default(0),
})
export type CostCard = z.infer<typeof CostCardSchema>

/**
 * A merchant's facts about a route, keyed by the exact route (`providerId:serviceId`) or by
 * carrier + channel (`carrier:delhivery|channel:direct`). Insurance cannot be read from any
 * courier API, so `insures` is what the merchant confirms; null keeps the seeded default.
 * The insurance rate is empty until the merchant fills it in (owner, 29 Oct: the cost is not
 * known yet); an empty rate prices insurance at ₹0 and the admin warns about it.
 */
export const RouteSettingInputSchema = z.object({
  key: z.string().trim().min(1).max(160),
  insures: z.boolean().nullish(),
  insurancePercent: percent.nullish(),
  insuranceMinPaise: paise.nullish(),
  costCard: CostCardSchema.nullish(),
  enabled: z.boolean().default(true),
  /** Checkout names the courier to shoppers ("Express · Blue Dart"); null keeps it shown. */
  showName: z.boolean().nullish(),
})
export type RouteSettingInput = z.infer<typeof RouteSettingInputSchema>
export type RouteSetting = RouteSettingInput

/** The key a carrier-wide setting is saved under. */
export const carrierSettingKey = (carrier: string, channel: string): string =>
  `carrier:${carrier}|channel:${channel}`

/** One courier at one speed, as the courier list and `couriers.allow` name it. */
export const courierId = (carrierKey: string, speed: DeliverySpeed): string =>
  `${carrierKey}:${speed}`

/**
 * How checkout shows the options. `fixed`: each enabled option is its own card (as before).
 * `list`: the courier list: only the first enabled option shows, every courier it allows as
 * its own card (the cheapest included in its price, faster ones at the difference).
 */
export const DELIVERY_LAYOUTS = ['fixed', 'list'] as const
export type DeliveryLayout = (typeof DELIVERY_LAYOUTS)[number]

/** Everything the engine reads, as loaded for one store. */
export type DeliveryConfig = {
  /** Omitted: `fixed`. Saved in the app's own settings (`store.apps`), like the Protect card. */
  layout?: DeliveryLayout | undefined
  options: DeliveryOption[]
  rules: RouteRule[]
  routeSettings: RouteSetting[]
  /** Delhivery Protect's card (rates per category, type overrides); omitted: the defaults. */
  protect?: ProtectCard | undefined
  /** Bumped on every save; part of the quote snapshot's identity. */
  version: string
}

/** The empty-state preset: Standard (cheapest, COD) and Express (fastest, prepaid). */
export const PRESET_OPTIONS: DeliveryOptionInput[] = [
  DeliveryOptionInputSchema.parse({ name: 'Standard', speed: 'standard', strategy: 'cheapest' }),
  DeliveryOptionInputSchema.parse({
    name: 'Express',
    speed: 'express',
    strategy: 'fastest',
    cod: { mode: 'prepaid_only' },
  }),
]
