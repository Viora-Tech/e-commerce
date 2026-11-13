import type { RouteRule, RouteSelector } from '@commerce/core/delivery-options'
import type { deliveryOptionsContent } from '@/data/delivery-options'
import type { api } from '@/lib/api-client'

export type Overview = Awaited<ReturnType<typeof api.deliveryOptions.overview>>
export type TryPinResult = Awaited<ReturnType<typeof api.deliveryOptions.tryPin>>
export type RouteCatalogue = Awaited<ReturnType<typeof api.deliveryOptions.routeCatalogue>>
export type CatalogueRoute = RouteCatalogue['routes'][number]
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

/** "Glasspads → all options → Delhivery, insured". */
export function ruleSummary(rule: RouteRule, optionNames: Map<string, string>, copy: Copy): string {
  const t = rule.target
  const target =
    t.kind === 'tags'
      ? copy.rules.targets.tags(t.values.join(', '))
      : t.kind === 'types'
        ? copy.rules.targets.types(t.values.join(', '))
        : copy.rules.targets[t.kind](t.values.length)
  const options =
    rule.optionIds === 'all'
      ? copy.rules.allOptions
      : rule.optionIds.map((id) => optionNames.get(id) ?? '?').join(', ')
  const main = rule.defaultRoute
    ? selectorLabel(rule.defaultRoute, copy)
    : rule.routes.map((r) => selectorLabel(r, copy)).join(' / ')
  const alts = rule.alternatives.length
    ? copy.rules.orAlt(rule.alternatives.map((r) => selectorLabel(r, copy)).join(', '))
    : ''
  const insured = rule.insurance === 'required' ? `, ${copy.rules.insured}` : ''
  return `${rule.name}: ${copy.rules.summary(target, options, `${main}${alts}${insured}`)}`
}
