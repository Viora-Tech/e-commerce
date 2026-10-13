/**
 * Store settings: what Shopify has against what this store has, part by part. Pure:
 * it takes what `api-settings.ts` read and what `settings-import.ts` loaded, and returns
 * the lines the merchant sees plus the writes that make them true. Planning the same
 * input twice gives the same answer, and planning after an import gives only `same`
 * lines, which is what makes a second import change nothing. This file holds the shared
 * shapes plus store details, tax and locations; shipping (`settings-plan-shipping.ts`)
 * and policies and extra fields (`settings-plan-content.ts`) sit beside it.
 */
import {
  type LocationDetails,
  type PolicyType,
  type ShippingZoneWrite,
  type StoreAddress,
  type StoreProfile,
  type StoreProfilePatch,
  stateCode,
} from '@commerce/core'
import type { MetafieldDefinitionWrite } from '@commerce/core/metaobjects'
import { normalisePhone } from '@commerce/core/phone'
import type { NLocation, NSettingsAddress, NShopSettings } from './api-settings'
import type { RichText } from './html'
import type { SettingsItem } from './settings-client'

/* ------------------------------------------------------------ what is here */

export type LocalLocation = LocationDetails & { id: string; isDefault: boolean }

export type LocalRate = {
  id: string
  name: string
  condition: 'none' | 'order_value' | 'weight'
  minValue: number | null
  maxValue: number | null
  pricePaise: number
  freeAbovePaise: number | null
  codSurchargePaise: number | null
  minTransitDays: number | null
  maxTransitDays: number | null
}

export type LocalZone = {
  id: string
  name: string
  stateCodes: string[]
  pincodeRules: ShippingZoneWrite['pincodeRules']
  rates: LocalRate[]
}

export type LocalPolicy = {
  type: PolicyType
  exists: boolean
  title: string
  body: unknown
  published: boolean
}

export type LocalField = {
  id: string
  ownerType: string
  namespace: string
  key: string
  type: string
  list: boolean
}

export type LocalSettings = {
  profile: StoreProfile
  /** The default GST registration's number, and every active one. */
  defaultGstin: string | null
  gstins: string[]
  locations: LocalLocation[]
  zones: LocalZone[]
  policies: LocalPolicy[]
  fields: LocalField[]
  /** Shopify id → our id from earlier imports. */
  mapped: {
    locations: ReadonlyMap<string, string>
    zones: ReadonlyMap<string, string>
    fields: ReadonlyMap<string, string>
    /** Shopify content type ids → ours, for extra fields that link to entries. */
    contentTypes: ReadonlyMap<string, string>
  }
}

/* --------------------------------------------------------------- the plan */

/** Import mapping resources for what this step creates (extra fields share the main import's). */
export const SETTINGS_MAPPINGS = {
  locations: 'settings_locations',
  zones: 'settings_shipping_zones',
  fields: 'metafield_definitions',
} as const

export type SettingsOp =
  | { kind: 'profile'; patch: StoreProfilePatch }
  | { kind: 'location'; id: string | null; sourceId: string | null; details: LocationDetails }
  | { kind: 'gstin'; gstin: string }
  | { kind: 'zone'; id: string | null; sourceId: string; write: ShippingZoneWrite }
  | { kind: 'policy'; type: PolicyType; title: string; body: RichText; published: boolean }
  | { kind: 'field'; sourceId: string; write: MetafieldDefinitionWrite }
  /** Remember a match that needed no change, so a rename on either side keeps it matched. */
  | { kind: 'map'; resource: string; sourceId: string; localId: string }

export type PartPlan = { items: SettingsItem[]; ops: SettingsOp[] }

/* ---------------------------------------------------------------- helpers */

const PIN = /^[1-9][0-9]{5}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** The name `ensure_default_location` gives a store's first location. */
const GENERIC_DEFAULT = 'default location'

export const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const line = (parts: (string | null | undefined)[]) => parts.filter((p) => p?.trim()).join(', ')

function pinOf(a: NSettingsAddress): { pincode: string; bad: string | null } {
  const zip = a.zip.replace(/\s+/g, '')
  if (!zip) return { pincode: '', bad: null }
  if (PIN.test(zip)) return { pincode: zip, bad: null }
  return { pincode: '', bad: a.countryCode === 'IN' || !a.countryCode ? a.zip : null }
}

function storeAddressOf(a: NSettingsAddress): StoreAddress {
  return {
    line1: a.line1.slice(0, 200),
    line2: a.line2.slice(0, 200),
    city: a.city.slice(0, 100),
    state: a.province.slice(0, 100),
    pincode: pinOf(a).pincode,
    country: (a.countryCode || 'IN').slice(0, 2),
  }
}

const addressText = (a: StoreAddress) => line([a.line1, a.line2, a.city, a.state, a.pincode])

function locationAddressOf(name: string, a: NSettingsAddress): LocationDetails {
  const country = a.countryCode || 'IN'
  return {
    name: name.slice(0, 80),
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    stateCode:
      country === 'IN'
        ? (stateCode(a.province) ?? stateCode(a.provinceCode) ?? '')
        : a.provinceCode.slice(0, 8),
    pincode: pinOf(a).pincode,
    country,
    phone: normalisePhone(a.phone) ?? '',
  }
}

const locationText = (l: LocationDetails) =>
  line([l.line1, l.line2, l.city, l.stateCode, l.pincode])

const LOCATION_FIELDS = [
  'name',
  'line1',
  'line2',
  'city',
  'stateCode',
  'pincode',
  'country',
  'phone',
] as const

const sameLocation = (a: LocationDetails, b: LocationDetails) =>
  LOCATION_FIELDS.every((k) => (a[k] ?? '') === (b[k] ?? ''))

/** Shopify's value where it has one, ours where it is blank. */
function merged(local: LocationDetails, shopify: LocationDetails): LocationDetails {
  const out = { ...local }
  for (const k of LOCATION_FIELDS) if (shopify[k]) out[k] = shopify[k]
  return out
}

const on = (v: boolean) => (v ? 'on' : 'off')

/* -------------------------------------------------------------- store details */

export function planStore(shop: NShopSettings, local: LocalSettings): PartPlan {
  const items: SettingsItem[] = []
  const ops: SettingsOp[] = []
  const patch: StoreProfilePatch = {}
  const here = local.profile

  if (shop.name && shop.name !== here.name) {
    items.push({ action: 'update', subject: 'store_name', from: here.name, to: shop.name })
    patch.name = shop.name
  } else if (shop.name) items.push({ action: 'same', subject: 'store_name', to: here.name })

  if (shop.email && !EMAIL.test(shop.email)) {
    items.push({
      action: 'warn',
      subject: 'contact_email',
      reason: 'invalid_email',
      detail: shop.email,
    })
  } else if (shop.email && !same(shop.email, here.contactEmail)) {
    items.push({
      action: 'update',
      subject: 'contact_email',
      from: here.contactEmail || null,
      to: shop.email,
    })
    patch.contactEmail = shop.email
  } else if (shop.email)
    items.push({ action: 'same', subject: 'contact_email', to: here.contactEmail })

  const rawPhone = shop.address?.phone ?? ''
  if (rawPhone) {
    const phone = normalisePhone(rawPhone)
    const current = normalisePhone(here.contactPhone) ?? here.contactPhone
    if (!phone) {
      items.push({
        action: 'warn',
        subject: 'contact_phone',
        reason: 'invalid_phone',
        detail: rawPhone,
      })
    } else if (phone !== current) {
      items.push({
        action: 'update',
        subject: 'contact_phone',
        from: here.contactPhone || null,
        to: phone,
      })
      patch.contactPhone = phone
    } else items.push({ action: 'same', subject: 'contact_phone', to: here.contactPhone })
  }

  if (shop.address?.line1) {
    const next = storeAddressOf(shop.address)
    const bad = pinOf(shop.address).bad
    if (bad)
      items.push({ action: 'warn', subject: 'address', reason: 'invalid_pincode', detail: bad })
    if (addressText(next) !== addressText(here.address) || next.country !== here.address.country) {
      items.push({
        action: 'update',
        subject: 'address',
        from: addressText(here.address) || null,
        to: addressText(next),
      })
      patch.address = next
    } else items.push({ action: 'same', subject: 'address', to: addressText(here.address) })

    // The default location ships from the business address until the merchant gives it its own.
    const home = local.locations.find((l) => l.isDefault)
    if (home && !home.line1) {
      const details = { ...locationAddressOf(home.name, shop.address), name: home.name }
      items.push({
        action: 'update',
        subject: 'default_location_address',
        name: home.name,
        from: null,
        to: locationText(details),
      })
      ops.push({ kind: 'location', id: home.id, sourceId: null, details })
    }
  }

  if (shop.currency && shop.currency !== here.currency) {
    items.push({
      action: 'warn',
      subject: 'currency',
      reason: 'currency_mismatch',
      from: here.currency,
      to: shop.currency,
    })
  }
  if (shop.timezone && shop.timezone !== here.timezone) {
    items.push({
      action: 'warn',
      subject: 'timezone',
      reason: 'timezone_mismatch',
      from: here.timezone,
      to: shop.timezone,
    })
  }
  if (shop.weightUnit === 'POUNDS' || shop.weightUnit === 'OUNCES') {
    items.push({
      action: 'warn',
      subject: 'weight_unit',
      reason: 'weight_unit',
      detail: shop.weightUnit,
    })
  }

  if (Object.keys(patch).length) ops.unshift({ kind: 'profile', patch })
  return { items, ops }
}

/* ---------------------------------------------------------------------- tax */

export function planTax(shop: NShopSettings, local: LocalSettings): PartPlan {
  const items: SettingsItem[] = []
  const ops: SettingsOp[] = []
  const here = local.profile.pricesIncludeGst
  if (shop.taxesIncluded !== here) {
    items.push({
      action: 'update',
      subject: 'prices_include_tax',
      from: on(here),
      to: on(shop.taxesIncluded),
    })
    ops.push({ kind: 'profile', patch: { pricesIncludeGst: shop.taxesIncluded } })
  } else items.push({ action: 'same', subject: 'prices_include_tax', to: on(here) })

  // A GST registration here is never replaced: a different number from Shopify is a conflict.
  if (!shop.gstin) {
    if (local.defaultGstin) items.push({ action: 'same', subject: 'gstin', to: local.defaultGstin })
    else items.push({ action: 'manual', subject: 'gstin', reason: 'gstin_not_shared' })
  } else if (local.gstins.includes(shop.gstin)) {
    items.push({ action: 'same', subject: 'gstin', to: shop.gstin })
  } else if (local.defaultGstin) {
    items.push({
      action: 'conflict',
      subject: 'gstin',
      reason: 'gstin_exists',
      from: local.defaultGstin,
      to: shop.gstin,
    })
  } else {
    items.push({ action: 'create', subject: 'gstin', to: shop.gstin })
    ops.push({ kind: 'gstin', gstin: shop.gstin })
  }
  return { items, ops }
}

/* ---------------------------------------------------------------- locations */

/** Shopify's first place that ships online orders: what this store's default location stands for. */
function primaryOf(locations: readonly NLocation[]): NLocation | null {
  const own = locations.filter((l) => !l.app)
  return own.find((l) => l.fulfillsOnlineOrders) ?? own[0] ?? null
}

export function planLocations(source: readonly NLocation[], local: LocalSettings): PartPlan {
  const items: SettingsItem[] = []
  const ops: SettingsOp[] = []
  const primary = primaryOf(source)
  const home = local.locations.find((l) => l.isDefault) ?? null
  const taken = new Set<string>()

  for (const l of source) {
    if (l.app) {
      items.push({ action: 'manual', subject: 'location', name: l.name, reason: 'app_location' })
      continue
    }
    const mappedId = local.mapped.locations.get(l.sourceId)
    const match =
      local.locations.find((x) => x.id === mappedId && !taken.has(x.id)) ??
      local.locations.find((x) => same(x.name, l.name) && !taken.has(x.id)) ??
      (l === primary && home && !taken.has(home.id) && same(home.name, GENERIC_DEFAULT)
        ? home
        : null)
    const shopify = locationAddressOf(l.name, l.address)
    const bad = pinOf(l.address).bad
    if (bad)
      items.push({
        action: 'warn',
        subject: 'location',
        name: l.name,
        reason: 'invalid_pincode',
        detail: bad,
      })

    if (!match) {
      items.push({ action: 'create', subject: 'location', name: l.name, to: locationText(shopify) })
      ops.push({ kind: 'location', id: null, sourceId: l.sourceId, details: shopify })
    } else {
      taken.add(match.id)
      // A location matched by name keeps its name; the generic first location takes Shopify's.
      const name = same(match.name, GENERIC_DEFAULT) ? l.name : match.name
      const next = { ...merged(match, shopify), name }
      if (sameLocation(match, next)) {
        items.push({
          action: 'same',
          subject: 'location',
          name: match.name,
          to: locationText(match),
        })
        ops.push({
          kind: 'map',
          resource: SETTINGS_MAPPINGS.locations,
          sourceId: l.sourceId,
          localId: match.id,
        })
      } else {
        items.push({
          action: 'update',
          subject: 'location',
          name,
          from: match.name === name ? locationText(match) || null : match.name,
          to: match.name === name ? locationText(next) : name,
        })
        ops.push({ kind: 'location', id: match.id, sourceId: l.sourceId, details: next })
      }
    }
    if (l === primary && home && match?.id !== home.id) {
      items.push({
        action: 'warn',
        subject: 'location',
        name: l.name,
        reason: 'default_location',
        detail: home.name,
      })
    }
  }
  return { items, ops }
}
