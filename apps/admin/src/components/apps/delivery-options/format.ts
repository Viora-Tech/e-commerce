import type { RouteRule, RouteSelector } from '@commerce/core/delivery-options'
import type { deliveryOptionsContent } from '@/data/delivery-options'
import type { api } from '@/lib/api-client'

export type Overview = Awaited<ReturnType<typeof api.deliveryOptions.overview>>
export type TryPinResult = Awaited<ReturnType<typeof api.deliveryOptions.tryPin>>
export type RouteCatalogue = Awaited<ReturnType<typeof api.deliveryOptions.routeCatalogue>>
export type CatalogueRoute = RouteCatalogue['routes'][number]
export type RuleSuggestion = Awaited<ReturnType<typeof api.deliveryOptions.ruleSuggestions>>[number]
export type CollectionTwin = Awaited<ReturnType<typeof api.deliveryOptions.collectionTwins>>[number]
type Copy = typeof deliveryOptionsContent

/** Known couriers for the pickers: key and how the shopper reads it. */
export const CARRIERS: ReadonlyArray<{ key: string; name: string }> = [
  { key: 'delhivery', name: 'Delhivery' },
  { key: 'bluedart', name: 'Blue Dart' },
  { key: 'dtdc', name: 'DTDC' },
  { key: 'xpressbees', name: 'Xpressbees' },
  { key: 'ekart', name: 'Ekart' },
  { key: 'shadowfax', name: 'Shadowfax' },
  { key: 'ecom-express', name: 'Ecom Express' },
  { key: 'india-post', name: 'India Post' },
  { key: 'amazon', name: 'Amazon Shipping' },
]

export const carrierName = (key: string, anyCourier: string): string =>
  key === 'any' ? anyCourier : (CARRIERS.find((c) => c.key === key)?.name ?? key)

/** Paise shown in a rupee field (`parseRupees` from @commerce/money reads it back). */
export const toRupees = (paise: number | null | undefined): string =>
  paise == null ? '' : String(paise / 100)

export function toNumber(text: string): number | null {
  const n = Number(text.trim())
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n
}

/** "Delhivery Express (direct)", "Blue Dart (any app)". */
export function selectorLabel(sel: RouteSelector, copy: Copy): string {
  const speed =
    sel.speed === 'express'
      ? ` ${copy.ruleDialog.speeds.express}`
      : sel.speed === 'standard'
        ? ` ${copy.ruleDialog.speeds.standard}`
        : ''
  const channel =
    sel.channel && sel.channel !== 'any' ? ` (${channelLabel(sel.channel, copy)})` : ''
  return `${carrierName(sel.carrier, copy.routeDialog.anyCourier)}${speed}${channel}`
}

export function channelLabel(channel: string, copy: Copy): string {
  const known = copy.routeDialog.channels as Record<string, string>
  return known[channel] ?? channel
}

/** Same courier, app and speed (a rule's default is one of its routes). */
export const sameSelector = (a: RouteSelector, b: RouteSelector): boolean =>
  a.carrier === b.carrier &&
  (a.channel ?? 'any') === (b.channel ?? 'any') &&
  (a.speed ?? 'any') === (b.speed ?? 'any')

/** "1 collection", "All products", "Tagged “oversize”". */
export function ruleTargetLabel(rule: Pick<RouteRule, 'target'>, copy: Copy): string {
  const t = rule.target
  if (t.kind === 'all') return copy.rules.targets.all()
  if (t.kind === 'tags') return copy.rules.targets.tags(t.values.map((v) => `“${v}”`).join(', '))
  if (t.kind === 'types') return copy.rules.targets.types(t.values.join(', '))
  return copy.rules.targets[t.kind](t.values.length)
}

/**
 * Every route a rule allows, the preferred one first and marked (#1781: the Mouse rule allows
 * Delhivery Air and Surface but read "only Delhivery Express / Air"). `mark` words the
 * preferred route, e.g. "Delhivery Express / Air (preferred)".
 */
export function ruleRouteLabels(
  rule: RouteRule,
  copy: Copy,
  mark: (label: string, always: boolean) => string,
): string[] {
  const preferred = rule.defaultRoute ?? null
  const rest = rule.routes.filter((r) => !preferred || !sameSelector(r, preferred))
  return [
    ...(preferred ? [mark(selectorLabel(preferred, copy), rule.forceRoute === true)] : []),
    ...rest.map((r) => selectorLabel(r, copy)),
  ]
}

/** "Glasspads: 1 collection → all options → Delhivery, Blue Dart, insured". */
export function ruleSummary(rule: RouteRule, optionNames: Map<string, string>, copy: Copy): string {
  const options =
    rule.optionIds === 'all'
      ? copy.rules.allOptions
      : rule.optionIds.map((id) => optionNames.get(id) ?? '?').join(', ')
  const routes = ruleRouteLabels(rule, copy, (label) => label).join(', ')
  const alts = rule.alternatives.length
    ? copy.rules.orAlt(rule.alternatives.map((r) => selectorLabel(r, copy)).join(', '))
    : ''
  const insured = rule.insurance === 'required' ? `, ${copy.rules.insured}` : ''
  const target = ruleTargetLabel(rule, copy)
  return `${rule.name}: ${copy.rules.summary(target, options, `${routes}${alts}${insured}`)}`
}
