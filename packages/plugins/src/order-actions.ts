/** SOURCE OF TRUTH: app order actions — WHAT: validates `admin.orderActions` and derives each courier's Create shipment / WHY: apps add Shopify-style actions to orders without admin code per courier */
import type { OrderAction, OrderActionCondition, OrderActionTarget, PluginManifest } from './types'

/** Every place an order action can show. */
export const ORDER_ACTION_TARGETS: readonly OrderActionTarget[] = ['detail', 'row', 'bulk']

export const ORDER_ACTION_CONDITIONS: readonly OrderActionCondition[] = [
  'open',
  'unfulfilled',
  'paid-or-cod',
  'not-test',
]

/** What a member needs for an action that does not name a permission. */
export const DEFAULT_ORDER_ACTION_PERMISSION = 'orders.write'

const ACTION_ID = /^[a-z][a-z0-9-]*$/

/** The id of the Create shipment action derived for one courier. */
export const shipmentActionId = (providerId: string) => `ship-${providerId}`

type ManifestShape = Pick<PluginManifest, 'id' | 'admin'> & {
  provides: { shipping?: readonly { id: string; label: string }[] | undefined }
}

/**
 * Throws on an order action that could never work: a bad or repeated id, no label, no place to
 * show, a link outside the admin, a procedure key not namespaced `<pluginId>/`, or a courier the
 * plugin does not provide. Called by `definePlugin`, so a typo fails at import time.
 */
export function validateOrderActions(p: ManifestShape): void {
  const seen = new Set<string>()
  const couriers = new Set((p.provides.shipping ?? []).map((f) => f.id))
  const derived = new Set([...couriers].map(shipmentActionId))
  for (const a of p.admin?.orderActions ?? []) {
    const where = `order action "${a.id}" on plugin "${p.id}"`
    if (!ACTION_ID.test(a.id)) throw new Error(`${where}: id must be lowercase with dashes`)
    if (seen.has(a.id) || derived.has(a.id)) throw new Error(`${where} is declared twice`)
    seen.add(a.id)
    if (!a.label.en.trim()) throw new Error(`${where} needs an English label`)
    if (a.targets.length === 0) throw new Error(`${where} needs at least one target`)
    for (const t of a.targets) {
      if (!ORDER_ACTION_TARGETS.includes(t)) throw new Error(`${where}: unknown target "${t}"`)
    }
    for (const c of a.requires ?? []) {
      if (!ORDER_ACTION_CONDITIONS.includes(c)) {
        throw new Error(`${where}: unknown condition "${c}"`)
      }
    }
    const h = a.handler
    if (h.type === 'link' && (!h.path.startsWith('/') || h.path.startsWith('//'))) {
      throw new Error(`${where}: a link must be an admin path starting with "/"`)
    }
    if (h.type === 'procedure' && !h.procedure.startsWith(`${p.id}/`)) {
      throw new Error(`${where}: procedure key must be namespaced "${p.id}/<name>"`)
    }
    if (h.type === 'shipment' && !couriers.has(h.providerId)) {
      throw new Error(`${where}: "${h.providerId}" is not a courier this plugin provides`)
    }
  }
}

/**
 * An app's order actions: the ones it declares, then a Create shipment for each courier it
 * provides (the core plugin's demo courier excepted: the order page has its own Create shipment).
 * One courier is labelled plainly since the app's name heads the group; several say which.
 */
export function orderActionsOf(p: ManifestShape, coreId = 'core'): OrderAction[] {
  const declared = (p.admin?.orderActions ?? []).map((a) => ({
    ...a,
    label: { ...a.label },
    targets: [...a.targets],
    handler: { ...a.handler },
    ...(a.requires ? { requires: [...a.requires] } : {}),
  }))
  if (p.id === coreId) return declared
  const couriers = p.provides.shipping ?? []
  const shipments: OrderAction[] = couriers.map((f) => ({
    id: shipmentActionId(f.id),
    label:
      couriers.length === 1
        ? { en: 'Create shipment', hi: 'शिपमेंट बनाएं' }
        : { en: `Create shipment with ${f.label}`, hi: `${f.label} से शिपमेंट बनाएं` },
    targets: [...ORDER_ACTION_TARGETS],
    handler: { type: 'shipment', providerId: f.id },
    permission: 'orders.fulfil',
    requires: ['open', 'unfulfilled', 'paid-or-cod'],
  }))
  return [...declared, ...shipments]
}
