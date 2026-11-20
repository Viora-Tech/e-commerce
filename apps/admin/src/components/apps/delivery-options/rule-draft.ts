/** SOURCE OF TRUTH: the Product rule dialog's form state
 * WHAT:  A rule as the dialog edits it, in four steps (owner, 20 Nov 2026): which products, the
 *        couriers shoppers can choose from (courier and speed chips, `delhivery:express`), the
 *        courier included in the price (`defaultRoute`; "only this one" is `forceRoute`) and
 *        what it costs (`price`), plus Through, insurance and options under More. A rule whose
 *        routes can't be said as chips (a pinned service, two accounts) keeps the detailed
 *        route editor. `ruleInputOf` turns it back into the SAME rule schema.
 * WHY:   The owner read the old courier list as "these are free". Prices now have their own
 *        step, and the engine still reads selectors, so chips map onto them.
 * WHERE: rule-dialog.tsx and its field components; presets in rule-presets.ts.
 */
import type {
  DeliverySpeed,
  RouteRule,
  RouteRuleInput,
  RouteSelector,
  RulePriceMode,
  RuleTargetKind,
} from '@commerce/core/delivery-options'
import { parseRupees } from '@commerce/money'
import { sameSelector, toRupees } from './format'

/** "Through": the route selector's `channel`. */
export const THROUGH = ['any', 'direct', 'rapidshyp', 'shiprocket', 'aggregator'] as const
export type Through = (typeof THROUGH)[number]

/** The dialog offers these; `aggregator` only shows for a rule saved with it. */
export const THROUGH_OFFERED: readonly Through[] = ['any', 'direct', 'rapidshyp', 'shiprocket']

export type RuleDraft = {
  name: string
  kind: RuleTargetKind
  /** Picked product or collection ids. */
  values: string[]
  /** Their titles, when picked in this dialog (an opened rule only knows the ids). */
  titles: string[]
  /** Tags or product types as typed, comma separated. */
  text: string
  optionIds: 'all' | string[]
  /** The saved routes can't be said as chips: edit them one by one instead. */
  custom: boolean
  /** The couriers shoppers can choose from: `carrier:speed` (`delhivery:express`). */
  chips: string[]
  through: Through
  /** The included courier, `carrier:speed` (or `carrier:any` as saved); null: the cheapest. */
  preferred: string | null
  forceRoute: boolean
  /** The saved alternatives, kept while their courier stays in the rule. */
  keptAlternatives: RouteSelector[]
  /** Detailed mode: the routes, the default's index and the alternatives' indexes. */
  routes: RouteSelector[]
  defaultIndex: number | null
  alternatives: number[]
  insurance: RouteRuleInput['insurance']
  priceMode: RulePriceMode
  /** Rupees as typed. */
  fixed: string
  freeAboveOn: boolean
  freeAbove: string
  enabled: boolean
}

/** Target kinds the dialog offers, "All products" first (#1782). */
export const KINDS: RuleTargetKind[] = ['all', 'collections', 'products', 'tags', 'types']

const SPEEDS: readonly DeliverySpeed[] = ['standard', 'express']

/** Products and collections are picked; tags and types are typed. */
export const picks = (kind: RuleTargetKind): boolean =>
  kind === 'products' || kind === 'collections'

const isThrough = (v: string): v is Through => THROUGH.some((t) => t === v)

export const chipId = (carrier: string, speed: DeliverySpeed): string => `${carrier}:${speed}`

/** A chip's carrier and speed. */
export function splitChip(id: string): { carrier: string; speed: DeliverySpeed | 'any' } {
  const [carrier = '', speed = 'any'] = id.split(':')
  return { carrier, speed: speed === 'standard' || speed === 'express' ? speed : 'any' }
}

const chipsOf = (s: RouteSelector): string[] =>
  (!s.speed || s.speed === 'any' ? SPEEDS : [s.speed]).map((sp) => chipId(s.carrier, sp))

/** The chips a saved rule reads as, or null when its routes need the detailed editor. */
function chipsOfRule(rule: RouteRule): Pick<RuleDraft, 'chips' | 'through' | 'preferred'> | null {
  if (rule.routes.some((r) => r.serviceId)) return null
  const channels = [...new Set(rule.routes.map((r) => r.channel ?? 'any'))]
  const through = channels[0]
  if (channels.length !== 1 || !through || !isThrough(through)) return null
  const chips = [...new Set(rule.routes.flatMap(chipsOf))]
  const def = rule.defaultRoute
  if (def && (def.serviceId || (def.channel ?? 'any') !== through)) return null
  if (def && !chips.some((c) => splitChip(c).carrier === def.carrier)) return null
  return { chips, through, preferred: def ? `${def.carrier}:${def.speed ?? 'any'}` : null }
}

export function blankDraft(): RuleDraft {
  return {
    name: '',
    kind: 'collections',
    values: [],
    titles: [],
    text: '',
    optionIds: 'all',
    custom: false,
    chips: [],
    through: 'any',
    preferred: null,
    forceRoute: false,
    keptAlternatives: [],
    routes: [],
    defaultIndex: null,
    alternatives: [],
    insurance: 'follow_option',
    priceMode: 'option',
    fixed: '',
    freeAboveOn: false,
    freeAbove: '',
    enabled: true,
  }
}

export function draftOf(rule: RouteRule | null): RuleDraft {
  const blank = blankDraft()
  if (!rule) return blank
  const indexOf = (s: RouteSelector) => rule.routes.findIndex((r) => sameSelector(r, s))
  const def = rule.defaultRoute ? indexOf(rule.defaultRoute) : -1
  const simple = chipsOfRule(rule)
  // Saved before rule prices: the option's own price.
  const price = rule.price ?? { mode: 'option' }
  return {
    ...blank,
    ...(simple ?? {}),
    name: rule.name,
    kind: rule.target.kind,
    values: rule.target.values,
    text: rule.target.values.join(', '),
    optionIds: rule.optionIds,
    custom: simple === null,
    forceRoute: rule.forceRoute === true,
    keptAlternatives: rule.alternatives,
    routes: rule.routes,
    defaultIndex: def >= 0 ? def : null,
    alternatives: rule.alternatives.map(indexOf).filter((i) => i >= 0),
    insurance: rule.insurance,
    priceMode: price.mode,
    fixed: toRupees(price.fixedPaise),
    freeAboveOn: price.freeAbovePaise != null,
    freeAbove: toRupees(price.freeAbovePaise),
    enabled: rule.enabled,
  }
}

/** Whether the included courier is among the ticked chips. */
export function preferredTicked(d: Pick<RuleDraft, 'chips' | 'preferred'>): boolean {
  if (d.preferred === null) return true
  const { carrier, speed } = splitChip(d.preferred)
  return speed === 'any'
    ? d.chips.some((c) => splitChip(c).carrier === carrier)
    : d.chips.includes(d.preferred)
}

/** Drops an included courier the rule no longer allows, and "only this one" with it. */
export function withValidPreferred(d: RuleDraft): RuleDraft {
  if (d.custom || preferredTicked(d)) return d
  return { ...d, preferred: null, forceRoute: false }
}

/** Tags or types as typed: "oversize, fragile" → ["oversize", "fragile"]. */
export const typedValues = (text: string): string[] =>
  text
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean)

export const targetValues = (d: RuleDraft): string[] =>
  d.kind === 'all' ? [] : picks(d.kind) ? d.values : typedValues(d.text)

export type RuleErrors = {
  name: boolean
  target: boolean
  couriers: boolean
  routes: boolean
  fixed: boolean
  freeAbove: boolean
}

export function ruleErrors(d: RuleDraft): RuleErrors {
  return {
    name: !d.name.trim(),
    target: d.kind !== 'all' && targetValues(d).length === 0,
    couriers: !d.custom && d.chips.length === 0,
    routes: d.custom && d.routes.length === 0,
    fixed: d.priceMode === 'fixed' && parseRupees(d.fixed) === null,
    freeAbove: d.priceMode !== 'free' && d.freeAboveOn && parseRupees(d.freeAbove) === null,
  }
}

/** The chips as selectors: one per courier, `any` when both of its speeds are ticked. */
function selectorsOf(chips: readonly string[], through: Through): RouteSelector[] {
  const byCarrier = new Map<string, Set<DeliverySpeed>>()
  for (const c of chips) {
    const { carrier, speed } = splitChip(c)
    const set = byCarrier.get(carrier) ?? new Set<DeliverySpeed>()
    for (const s of speed === 'any' ? SPEEDS : [speed]) set.add(s)
    byCarrier.set(carrier, set)
  }
  return [...byCarrier].map(([carrier, speeds]) => ({
    carrier,
    channel: through,
    speed: speeds.size === SPEEDS.length ? 'any' : ([...speeds][0] ?? 'any'),
  }))
}

/** The draft as the API saves it. */
export function ruleInputOf(d: RuleDraft): RouteRuleInput {
  const fixed = parseRupees(d.fixed)
  const base = {
    name: d.name.trim(),
    target: { kind: d.kind, values: targetValues(d) },
    optionIds: d.optionIds,
    insurance: d.insurance,
    price: {
      mode: d.priceMode,
      fixedPaise: d.priceMode === 'fixed' ? fixed : null,
      freeAbovePaise: d.priceMode !== 'free' && d.freeAboveOn ? parseRupees(d.freeAbove) : null,
    },
    enabled: d.enabled,
  }
  if (d.custom) {
    const defaultRoute = d.defaultIndex === null ? null : (d.routes[d.defaultIndex] ?? null)
    return {
      ...base,
      routes: d.routes,
      defaultRoute,
      alternatives: d.alternatives.flatMap((i) => d.routes[i] ?? []),
      forceRoute: defaultRoute !== null && d.forceRoute,
    }
  }
  const routes = selectorsOf(d.chips, d.through)
  const preferred = d.preferred ? splitChip(d.preferred) : null
  const defaultRoute: RouteSelector | null = preferred
    ? { carrier: preferred.carrier, channel: d.through, speed: preferred.speed }
    : null
  const carriers = new Set(routes.map((r) => r.carrier))
  return {
    ...base,
    routes,
    defaultRoute,
    alternatives: d.keptAlternatives.filter((a) => carriers.has(a.carrier)),
    forceRoute: defaultRoute !== null && d.forceRoute,
  }
}
