/** Store settings › shipping and packages: Shopify's delivery profiles against this store's zones and rates. Pure. */
import { type ShippingZoneWrite, ShippingZoneWriteSchema, stateCode } from '@commerce/core'
import type { NDeliveryMethod, NDeliveryProfile, NDeliveryZone, NLocation } from './api-settings'
import type { SettingsItem, SettingsRatePreview } from './settings-client'
import {
  type LocalRate,
  type LocalSettings,
  type PartPlan,
  SETTINGS_MAPPINGS,
  type SettingsOp,
  same,
} from './settings-plan'

/* ----------------------------------------------------------------- shipping */

const INDIA_STATES = 36

type RateResult = { ok: true; rate: Omit<LocalRate, 'id'> } | { ok: false; item: SettingsItem }

function planRate(m: NDeliveryMethod): RateResult {
  const manual = (reason: SettingsItem['reason'], detail?: string): RateResult => ({
    ok: false,
    item: {
      action: 'manual',
      subject: 'shipping_zone',
      name: m.name,
      reason,
      ...(detail ? { detail } : {}),
    },
  })
  if (!m.price) return manual('carrier_rates', m.carrier ?? undefined)
  if (m.price.currency !== 'INR') return manual('rate_currency', m.price.currency)
  const price = m.conditions.filter((c) => c.field === 'price')
  const weight = m.conditions.filter((c) => c.field === 'weight')
  if (price.length && weight.length) return manual('mixed_conditions')
  const foreign = price.find((c) => c.field === 'price' && c.currency !== 'INR')
  if (foreign && foreign.field === 'price') return manual('rate_currency', foreign.currency)
  const bound = (op: 'min' | 'max') => {
    const c = m.conditions.find((x) => x.operator === op)
    if (!c) return null
    const v = c.field === 'price' ? c.amount : c.grams
    // Shopify's upper bound is included; ours is not, so it moves up by one paisa or gram.
    return op === 'max' ? v + 1 : v
  }
  const condition = price.length ? 'order_value' : weight.length ? 'weight' : 'none'
  return {
    ok: true,
    rate: {
      name: m.name.slice(0, 80) || 'Shipping',
      condition,
      minValue: condition === 'none' ? null : bound('min'),
      maxValue: condition === 'none' ? null : bound('max'),
      pricePaise: m.price.amount,
      freeAbovePaise: null,
      codSurchargePaise: null,
      minTransitDays: null,
      maxTransitDays: null,
    },
  }
}

const rateKey = (
  r: Pick<LocalRate, 'name' | 'condition' | 'minValue' | 'maxValue' | 'pricePaise'>,
) => [r.name.toLowerCase(), r.condition, r.minValue, r.maxValue, r.pricePaise].join('|')

const preview = (r: Omit<LocalRate, 'id'>): SettingsRatePreview => ({
  name: r.name,
  condition: r.condition,
  min: r.minValue,
  max: r.maxValue,
  pricePaise: r.pricePaise,
})

function zoneStates(zone: NDeliveryZone, items: SettingsItem[]): string[] | null {
  const india = zone.countries.find((c) => c.code === 'IN')
  if (!india) return null
  if (india.provinces.length === 0 || india.provinces.length >= INDIA_STATES) return []
  const codes = new Set<string>()
  for (const p of india.provinces) {
    const code = stateCode(p.name) ?? stateCode(p.code)
    if (code) codes.add(code)
    else
      items.push({
        action: 'warn',
        subject: 'shipping_zone',
        name: zone.name,
        reason: 'unknown_state',
        detail: p.name,
      })
  }
  return codes.size ? [...codes].sort() : null
}

export function planShipping(
  profiles: readonly NDeliveryProfile[],
  locations: readonly NLocation[] | null,
  local: LocalSettings,
): PartPlan {
  const items: SettingsItem[] = []
  const ops: SettingsOp[] = []
  const taken = new Set<string>()
  for (const p of profiles) {
    if (!p.default) {
      items.push({
        action: 'manual',
        subject: 'delivery_profile',
        name: p.name,
        reason: 'product_profile',
      })
    }
  }
  const zones = profiles.find((p) => p.default)?.zones ?? []
  for (const zone of zones) {
    const others = zone.countries.filter((c) => c.code !== 'IN')
    const states = zoneStates(zone, items)
    if (states === null) {
      const reason = zone.countries.some((c) => c.code === 'IN')
        ? 'zone_no_rates'
        : 'zone_outside_india'
      items.push({ action: 'manual', subject: 'shipping_zone', name: zone.name, reason })
      continue
    }
    if (others.length) {
      items.push({
        action: 'warn',
        subject: 'shipping_zone',
        name: zone.name,
        reason: 'zone_other_countries',
        detail: others.map((c) => (c.restOfWorld ? '*' : c.code)).join(', '),
      })
    }
    const rates: Omit<LocalRate, 'id'>[] = []
    for (const m of zone.methods.filter((x) => x.active)) {
      const planned = planRate(m)
      if (planned.ok) rates.push(planned.rate)
      else items.push({ ...planned.item, detail: planned.item.detail ?? zone.name })
    }
    const mappedId = local.mapped.zones.get(zone.sourceId)
    const match =
      local.zones.find((z) => z.id === mappedId && !taken.has(z.id)) ??
      local.zones.find((z) => same(z.name, zone.name) && !taken.has(z.id)) ??
      null
    // Rates the merchant already has keep their id, COD fee, free-above and delivery days.
    const reused = new Set<string>()
    const write: ShippingZoneWrite = {
      name: (match?.name ?? zone.name).slice(0, 80) || 'Shipping zone',
      stateCodes: states,
      pincodeRules: match?.pincodeRules ?? [],
      rates: rates.map((r) => {
        const old = match?.rates.find((x) => same(x.name, r.name) && !reused.has(x.id))
        if (old) reused.add(old.id)
        return old
          ? {
              ...r,
              id: old.id,
              freeAbovePaise: old.freeAbovePaise,
              codSurchargePaise: old.codSurchargePaise,
              minTransitDays: old.minTransitDays,
              maxTransitDays: old.maxTransitDays,
            }
          : r
      }),
    }
    if (rates.length === 0 || !ShippingZoneWriteSchema.safeParse(write).success) {
      items.push({
        action: 'manual',
        subject: 'shipping_zone',
        name: zone.name,
        reason: 'zone_no_rates',
      })
      continue
    }
    const shown = rates.map(preview)
    if (!match) {
      items.push({ action: 'create', subject: 'shipping_zone', name: write.name, rates: shown })
      ops.push({ kind: 'zone', id: null, sourceId: zone.sourceId, write })
      continue
    }
    taken.add(match.id)
    const unchanged =
      [...match.stateCodes].sort().join() === states.join() &&
      match.rates.map(rateKey).join('\n') === write.rates.map(rateKey).join('\n')
    if (unchanged) {
      items.push({ action: 'same', subject: 'shipping_zone', name: match.name, rates: shown })
      ops.push({
        kind: 'map',
        resource: SETTINGS_MAPPINGS.zones,
        sourceId: zone.sourceId,
        localId: match.id,
      })
    } else {
      items.push({ action: 'update', subject: 'shipping_zone', name: match.name, rates: shown })
      ops.push({ kind: 'zone', id: match.id, sourceId: zone.sourceId, write })
    }
  }
  for (const l of locations ?? []) {
    if (l.localPickup && !l.app) {
      items.push({ action: 'manual', subject: 'location', name: l.name, reason: 'local_pickup' })
    }
  }
  return { items, ops }
}

/* ------------------------------------------------------------------ packages */

/** Shopify keeps saved packages to itself (no Admin API read), so this part only says so. */
export const planPackages = (): PartPlan => ({
  items: [{ action: 'manual', subject: 'packages', reason: 'packages_not_shared' }],
  ops: [],
})
