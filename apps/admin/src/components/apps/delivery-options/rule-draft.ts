/** SOURCE OF TRUTH: the Product rule dialog's form state
 * WHAT:  A rule as the dialog edits it: one sentence ("Glasspads ship only with Delhivery"),
 *        through which account, which speeds, a preferred courier and "always by it at the
 *        option's price" (`forceRoute`), or, for a rule whose routes can't be said that way,
 *        the routes one by one. `ruleInputOf` turns it back into the SAME rule schema
 *        (routes, target, defaultRoute, alternatives, insurance, optionIds, forceRoute).
 * WHY:   Owner, 17 Nov (#1781): the old dialog made the admin think in Courier × Channel ×
 *        Speed rows. The engine still reads selectors, so the sentence maps onto them.
 * WHERE: rule-dialog.tsx and its field components.
 */
import type {
  DeliverySpeed,
  RouteRule,
  RouteRuleInput,
  RouteSelector,
  RuleTargetKind,
} from '@commerce/core/delivery-options'
import { sameSelector } from './format'

/** "Through": the route selector's `channel`. */
export const THROUGH = ['any', 'direct', 'rapidshyp', 'shiprocket', 'aggregator'] as const
export type Through = (typeof THROUGH)[number]

/** The sentence offers these; `aggregator` only shows for a rule saved with it. */
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
  /** The saved routes can't be said as one sentence: edit them one by one instead. */
  custom: boolean
  /** Sentence mode: carrier keys ("delhivery"). */
  carriers: string[]
  through: Through
  standard: boolean
  express: boolean
  /** `carrier:speed` (`delhivery:express`, `delhivery:any`); null: no preferred courier. */
  preferred: string | null
  forceRoute: boolean
  /** Sentence mode: the saved alternatives, kept while their courier stays in the rule. */
  keptAlternatives: RouteSelector[]
  /** Detailed mode: the routes, the default's index and the alternatives' indexes. */
  routes: RouteSelector[]
  defaultIndex: number | null
  alternatives: number[]
  insurance: RouteRuleInput['insurance']
  enabled: boolean
}

/** Target kinds the dialog offers, "All products" first (#1782). */
export const KINDS: RuleTargetKind[] = ['all', 'collections', 'products', 'tags', 'types']

/** Products and collections are picked; tags and types are typed. */
export const picks = (kind: RuleTargetKind): boolean =>
  kind === 'products' || kind === 'collections'

const isThrough = (v: string): v is Through => THROUGH.some((t) => t === v)

const speedsOf = (s: RouteSelector): DeliverySpeed[] =>
  !s.speed || s.speed === 'any' ? ['standard', 'express'] : [s.speed]

/** The sentence a saved rule reads as, or null when its routes need the detailed editor. */
function sentenceOf(
  rule: RouteRule,
): Pick<RuleDraft, 'carriers' | 'through' | 'standard' | 'express' | 'preferred'> | null {
  if (rule.routes.some((r) => r.serviceId)) return null
  const channels = [...new Set(rule.routes.map((r) => r.channel ?? 'any'))]
  const through = channels[0]
  if (channels.length !== 1 || !through || !isThrough(through)) return null
  const byCarrier = new Map<string, Set<DeliverySpeed>>()
  for (const r of rule.routes) {
    const set = byCarrier.get(r.carrier) ?? new Set<DeliverySpeed>()
    for (const s of speedsOf(r)) set.add(s)
    byCarrier.set(r.carrier, set)
  }
  const shapes = new Set([...byCarrier.values()].map((s) => [...s].sort().join()))
  const speeds = [...byCarrier.values()][0]
  if (shapes.size !== 1 || !speeds) return null
  const def = rule.defaultRoute
  if (def && (def.serviceId || (def.channel ?? 'any') !== through || !byCarrier.has(def.carrier))) {
    return null
  }
  return {
    carriers: [...byCarrier.keys()],
    through,
    standard: speeds.has('standard'),
    express: speeds.has('express'),
    preferred: def ? `${def.carrier}:${def.speed ?? 'any'}` : null,
  }
}

export function draftOf(rule: RouteRule | null): RuleDraft {
  const blank: RuleDraft = {
    name: '',
    kind: 'collections',
    values: [],
    titles: [],
    text: '',
    optionIds: 'all',
    custom: false,
    carriers: ['delhivery'],
    through: 'any',
    standard: true,
    express: true,
    preferred: null,
    forceRoute: false,
    keptAlternatives: [],
    routes: [],
    defaultIndex: null,
    alternatives: [],
    insurance: 'follow_option',
    enabled: true,
  }
  if (!rule) return blank
  const indexOf = (s: RouteSelector) => rule.routes.findIndex((r) => sameSelector(r, s))
  const def = rule.defaultRoute ? indexOf(rule.defaultRoute) : -1
  const sentence = sentenceOf(rule)
  return {
    ...blank,
    ...(sentence ?? {}),
    name: rule.name,
    kind: rule.target.kind,
    values: rule.target.values,
    text: rule.target.values.join(', '),
    optionIds: rule.optionIds,
    custom: sentence === null,
    forceRoute: rule.forceRoute === true,
    keptAlternatives: rule.alternatives,
    routes: rule.routes,
    defaultIndex: def >= 0 ? def : null,
    alternatives: rule.alternatives.map(indexOf).filter((i) => i >= 0),
    insurance: rule.insurance,
    enabled: rule.enabled,
  }
}

/** The preferred courier choices: each courier at each ticked speed. */
export function preferredChoices(d: RuleDraft): Array<{ carrier: string; speed: DeliverySpeed }> {
  const speeds: DeliverySpeed[] = [
    ...(d.standard ? (['standard'] as const) : []),
    ...(d.express ? (['express'] as const) : []),
  ]
  return d.carriers.flatMap((carrier) => speeds.map((speed) => ({ carrier, speed })))
}

/** Drops a preferred courier the rule no longer allows, and "always" with it. */
export function withValidPreferred(d: RuleDraft): RuleDraft {
  if (d.custom || d.preferred === null) return d
  const [carrier, speed] = d.preferred.split(':')
  const ok =
    carrier !== undefined &&
    d.carriers.includes(carrier) &&
    (speed === 'any' || preferredChoices(d).some((c) => c.carrier === carrier && c.speed === speed))
  return ok ? d : { ...d, preferred: null, forceRoute: false }
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
  speeds: boolean
  routes: boolean
}

export function ruleErrors(d: RuleDraft): RuleErrors {
  return {
    name: !d.name.trim(),
    target: d.kind !== 'all' && targetValues(d).length === 0,
    couriers: !d.custom && d.carriers.length === 0,
    speeds: !d.custom && !d.standard && !d.express,
    routes: d.custom && d.routes.length === 0,
  }
}

/** The draft as the API saves it: the same rule schema as before, plus `forceRoute`. */
export function ruleInputOf(d: RuleDraft): RouteRuleInput {
  const base = {
    name: d.name.trim(),
    target: { kind: d.kind, values: targetValues(d) },
    optionIds: d.optionIds,
    insurance: d.insurance,
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
  const speed = d.standard && d.express ? 'any' : d.standard ? 'standard' : 'express'
  const [carrier, preferredSpeed] = d.preferred?.split(':') ?? []
  const defaultRoute: RouteSelector | null =
    carrier && preferredSpeed
      ? {
          carrier,
          channel: d.through,
          speed: preferredSpeed === 'any' ? 'any' : (preferredSpeed as DeliverySpeed),
        }
      : null
  return {
    ...base,
    routes: d.carriers.map((c) => ({ carrier: c, channel: d.through, speed })),
    defaultRoute,
    alternatives: d.keptAlternatives.filter((a) => d.carriers.includes(a.carrier)),
    forceRoute: defaultRoute !== null && d.forceRoute,
  }
}
