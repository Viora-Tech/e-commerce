/** SOURCE OF TRUTH: the Delivery options app's settings shapes — WHAT: zod schemas for a
 * delivery option (Standard, Express), a product or collection route rule and a per-route
 * setting (insures, insurance rate, cost card), plus the route selector both use / WHY: the
 * admin forms, the API, the database rows and the pure engine (`resolve.ts`) must agree on one
 * shape. Pure: no database, safe for the browser (`@commerce/core/delivery-options`).
 * Design: docs/superpowers/specs/2026-10-29-delivery-options-design.md.
 */
import { z } from 'zod'

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

export const OptionPriceSchema = z.object({
  /** `route`: route cost + markup + insurance, rounded up to ₹10. `zone`: Shipping rates. */
  source: z.enum(['route', 'zone']).default('route'),
  markupPaise: paise.default(0),
  markupPercent: percent.default(0),
  freeAbovePaise: paise.nullish(),
  minPaise: paise.nullish(),
  maxPaise: paise.nullish(),
})

export const OptionInsuranceSchema = z.object({
  default: z.enum(['on', 'off']).default('off'),
  /** Offered (and on by default) only from this order value up; null: every order. */
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
  /** Cards at most, the pick included. */
  max: z.number().int().min(2).max(8).default(3),
  /** +₹37 shows as +₹39. */
  roundTo9: z.boolean().default(true),
  /** Drop a courier another one beats on both price and date. */
  hideSlowerDearer: z.boolean().default(true),
  /**
   * Off, checkout shows only the delivery promise ("Standard", the date): no courier name or
   * logo on any of this option's cards, whatever each courier's own setting says (#1521).
   */
  showNames: z.boolean().default(true),
})
export type OptionCouriers = z.infer<typeof OptionCouriersSchema>

export const OptionCodSchema = z.object({
  /** Express is always prepaid only, whatever is saved here. */
  mode: z.enum(['prepaid_only', 'allowed']).default('allowed'),
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

export const RULE_TARGET_KINDS = ['products', 'collections', 'tags', 'types'] as const
export type RuleTargetKind = (typeof RULE_TARGET_KINDS)[number]

export const RouteRuleInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  target: z.object({
    kind: z.enum(RULE_TARGET_KINDS),
    /** Product or collection ids, or tag / product type values. */
    values: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
  }),
  /** `all`, or the ids of the options it applies to. */
  optionIds: z.union([z.literal('all'), z.array(z.string().min(1)).min(1).max(20)]).default('all'),
  routes: z.array(RouteSelectorSchema).min(1).max(20),
  defaultRoute: RouteSelectorSchema.nullish(),
  alternatives: z.array(RouteSelectorSchema).max(10).default([]),
  insurance: z.enum(['follow_option', 'required']).default('follow_option'),
  enabled: z.boolean().default(true),
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

/** Everything the engine reads, as loaded for one store. */
export type DeliveryConfig = {
  options: DeliveryOption[]
  rules: RouteRule[]
  routeSettings: RouteSetting[]
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
