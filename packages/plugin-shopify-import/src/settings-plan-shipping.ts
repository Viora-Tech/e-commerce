/** Store settings › shipping and packages: Shopify's delivery profiles against this store's zones and rates. Pure. */
import {
  HOME_COUNTRY,
  REST_OF_WORLD,
  type ShippingZoneWrite,
  ShippingZoneWriteSchema,
  stateCode,
} from '@commerce/core'
import type { NDeliveryMethod, NDeliveryProfile, NDeliveryZone, NLocation } from './api-settings'
import type { SettingsItem, SettingsRatePreview } from './settings-client'
import {
  type LocalRate,
  type LocalSettings,
  type LocalShippingProfile,
  type LocalZone,
  type PartPlan,
  SETTINGS_MAPPINGS,
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
  const india = zone.countries.find((c) => c.code === HOME_COUNTRY)
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

/**
 * Where a Shopify zone ships here: its countries (Shopify's "Rest of world" as `*`) and, when
 * India is one of them, its states. India with none of its regions recognised is left out of
 * the zone (the warnings say which); a zone left with no country is null.
 */
export function zoneCoverage(
  zone: NDeliveryZone,
  items: SettingsItem[],
): { countryCodes: string[]; stateCodes: string[] } | null {
  const states = zoneStates(zone, items)
  const codes = new Set<string>()
  for (const c of zone.countries) {
    if (c.restOfWorld) codes.add(REST_OF_WORLD)
    else if (c.code && /^[A-Z]{2}$/.test(c.code) && (c.code !== HOME_COUNTRY || states !== null)) {
      codes.add(c.code)
    }
  }
  if (codes.size === 0) return null
  // India first, then the rest as Shopify lists them, Rest of world last.
  const countryCodes = [...codes].sort(
    (a, b) =>
      Number(b === HOME_COUNTRY) - Number(a === HOME_COUNTRY) ||
      Number(a === REST_OF_WORLD) - Number(b === REST_OF_WORLD),
  )
  return { countryCodes, stateCodes: states ?? [] }
}

const sameCountries = (a: readonly string[] | undefined, b: readonly string[]) =>
  [...(a?.length ? a : [HOME_COUNTRY])].sort().join() === [...b].sort().join()

type ZoneScope = {
  /** The Shopify profile the zones belong to; null for the default one (General here). */
  profileSourceId: string | null
  /** This store's zones in the matching profile (none for a profile still to be created). */
  localZones: readonly LocalZone[]
}

function planZones(
  zones: readonly NDeliveryZone[],
  scope: ZoneScope,
  local: LocalSettings,
  taken: Set<string>,
  out: PartPlan,
): void {
  const { items, ops } = out
  const { profileSourceId } = scope
  for (const zone of zones) {
    // Zones abroad come over as country zones (audit #160); India keeps its states.
    const coverage = zoneCoverage(zone, items)
    if (coverage === null) {
      items.push({
        action: 'manual',
        subject: 'shipping_zone',
        name: zone.name,
        reason: 'zone_no_rates',
      })
      continue
    }
    const { countryCodes, stateCodes: states } = coverage
    const india = countryCodes.includes(HOME_COUNTRY)
    const rates: Omit<LocalRate, 'id'>[] = []
    for (const m of zone.methods.filter((x) => x.active)) {
      const planned = planRate(m)
      if (planned.ok) rates.push(planned.rate)
      else items.push({ ...planned.item, detail: planned.item.detail ?? zone.name })
    }
    const mappedId = local.mapped.zones.get(zone.sourceId)
    const match =
      scope.localZones.find((z) => z.id === mappedId && !taken.has(z.id)) ??
      scope.localZones.find((z) => same(z.name, zone.name) && !taken.has(z.id)) ??
      null
    // Rates the merchant already has keep their id, COD fee, free-above and delivery days.
    const reused = new Set<string>()
    const write: ShippingZoneWrite = {
      name: (match?.name ?? zone.name).slice(0, 80) || 'Shipping zone',
      countryCodes,
      stateCodes: states,
      pincodeRules: india ? (match?.pincodeRules ?? []) : [],
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
      ops.push({ kind: 'zone', id: null, sourceId: zone.sourceId, profileSourceId, write })
      continue
    }
    taken.add(match.id)
    const unchanged =
      sameCountries(match.countryCodes, countryCodes) &&
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
      ops.push({ kind: 'zone', id: match.id, sourceId: zone.sourceId, profileSourceId, write })
    }
  }
}

/**
 * A custom Shopify profile as a shipping profile here, matched by import mapping, then name.
 * Its products are the ones the products import brought over; the rest are counted in a warning.
 */
function planProfile(
  p: NDeliveryProfile,
  local: LocalSettings,
  out: PartPlan,
): LocalShippingProfile | null {
  const custom = local.shippingProfiles.filter((x) => !x.isDefault)
  const mappedId = local.mapped.shippingProfiles.get(p.sourceId)
  const match =
    custom.find((x) => x.id === mappedId) ?? custom.find((x) => same(x.name, p.name)) ?? null
  const productIds = [
    ...new Set(p.productIds.flatMap((id) => local.mapped.products.get(id) ?? [])),
  ].sort()
  const missing = p.productIds.length - productIds.length
  const name = (match?.name ?? p.name).slice(0, 80) || 'Shipping profile'
  const to = String(productIds.length)
  if (missing > 0) {
    out.items.push({
      action: 'warn',
      subject: 'delivery_profile',
      name: p.name,
      reason: 'profile_products_missing',
      detail: String(missing),
    })
  }
  if (match && [...match.productIds].sort().join() === productIds.join()) {
    out.items.push({ action: 'same', subject: 'delivery_profile', name, to })
    out.ops.push({
      kind: 'map',
      resource: SETTINGS_MAPPINGS.shippingProfiles,
      sourceId: p.sourceId,
      localId: match.id,
    })
    return match
  }
  out.items.push({
    action: match ? 'update' : 'create',
    subject: 'delivery_profile',
    name,
    from: match ? String(match.productIds.length) : null,
    to,
  })
  out.ops.push({
    kind: 'shipping_profile',
    id: match?.id ?? null,
    sourceId: p.sourceId,
    name,
    productIds,
  })
  return match
}

/**
 * Shopify's default profile becomes General's zones; each custom profile becomes a shipping
 * profile here with its products, then its own zones and rates.
 */
export function planShipping(
  profiles: readonly NDeliveryProfile[],
  locations: readonly NLocation[] | null,
  local: LocalSettings,
): PartPlan {
  const out: PartPlan = { items: [], ops: [] }
  const taken = new Set<string>()
  const general = local.shippingProfiles.find((x) => x.isDefault) ?? null
  const ordered = [...profiles].sort((a, b) => Number(b.default) - Number(a.default))
  for (const p of ordered) {
    if (p.default) {
      const localZones = local.zones.filter(
        (z) => z.profileId === null || z.profileId === general?.id,
      )
      planZones(p.zones, { profileSourceId: null, localZones }, local, taken, out)
      continue
    }
    const match = planProfile(p, local, out)
    const localZones = match ? local.zones.filter((z) => z.profileId === match.id) : []
    planZones(p.zones, { profileSourceId: p.sourceId, localZones }, local, taken, out)
  }
  for (const l of locations ?? []) {
    if (l.localPickup && !l.app) {
      out.items.push({
        action: 'manual',
        subject: 'location',
        name: l.name,
        reason: 'local_pickup',
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ packages */

/** Shopify keeps saved packages to itself (no Admin API read), so this part only says so. */
export const planPackages = (): PartPlan => ({
  items: [{ action: 'manual', subject: 'packages', reason: 'packages_not_shared' }],
  ops: [],
})
