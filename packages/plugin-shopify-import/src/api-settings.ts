/**
 * Store settings from the Admin API: the shop's details and tax switch, locations,
 * delivery profiles with their zones and rates, legal policies and extra field
 * definitions, mapped onto small shapes the planner (`settings-plan.ts`) reads.
 * Each part is read on its own, so a scope the connection lacks fails only that part.
 */

import { validateGstin } from '@commerce/core/gstin'
import { cleanMoneyFormat } from '@commerce/money'
import { definitionsOf } from './api-metafields'
import { mapFieldDefinition } from './api-metaobjects'
import { type GAddress, mapAddress, PAGE_INFO, type Page, read } from './api-settings-read'
import { fetchProfiles } from './api-settings-shipping'
import { fetchPurchaseOrders, fetchTransfers } from './api-settings-stock'
import type { SettingsPart } from './settings-client'
import type { NMarket } from './settings-plan-markets'
import type { NSegment } from './settings-plan-segments'
import type { NPurchaseOrder, NTransfer } from './settings-plan-stock'
import { type ShopifyClient, ShopifyError } from './shopify-client'
import type { NFieldDefinition } from './types'

/** One part's read: its data, or why Shopify would not give it. */
export type Read<T> = { ok: true; data: T } | { ok: false; access: boolean; error: string }

export type NSettingsAddress = {
  line1: string
  line2: string
  city: string
  province: string
  provinceCode: string
  countryCode: string
  zip: string
  phone: string
}

export type NShopSettings = {
  name: string
  /** The public contact email, else the owner's. */
  email: string
  address: NSettingsAddress | null
  currency: string
  timezone: string
  /** GRAMS, KILOGRAMS, OUNCES or POUNDS. */
  weightUnit: string
  taxesIncluded: boolean
  /** A valid GSTIN found in the shop's own extra fields (some GST apps keep it there), else null. */
  gstin: string | null
  /** The shop's price format as plain text (`Rs. {{amount}}`); null when it has no usable one. */
  moneyFormat: string | null
  /** Online Store › Preferences: the home page title and meta description ('' when unset). */
  seo: { title: string; description: string }
}

export type NLocation = {
  sourceId: string
  name: string
  fulfillsOnlineOrders: boolean
  /** Run by an app (a fulfilment service) rather than a place the merchant ships from. */
  app: boolean
  localPickup: boolean
  address: NSettingsAddress
}

export type NRateCondition =
  | { field: 'price'; operator: 'min' | 'max'; amount: number; currency: string }
  | { field: 'weight'; operator: 'min' | 'max'; grams: number }

export type NDeliveryMethod = {
  sourceId: string
  name: string
  active: boolean
  /** Null: rates calculated by a carrier or app (`carrier` names it). */
  price: { amount: number; currency: string } | null
  carrier: string | null
  conditions: NRateCondition[]
}

export type NDeliveryZone = {
  sourceId: string
  name: string
  countries: {
    code: string | null
    restOfWorld: boolean
    provinces: { name: string; code: string }[]
  }[]
  methods: NDeliveryMethod[]
}

export type NDeliveryProfile = {
  sourceId: string
  name: string
  default: boolean
  zones: NDeliveryZone[]
  /** Shopify product ids in the profile; empty for the default one (it holds the rest). */
  productIds: string[]
}

export type NPolicy = { type: string; title: string; body: string }

/** The Shopify owner types whose extra field definitions come over, and ours. */
const FIELD_OWNERS = [
  { shopify: 'PRODUCT', ours: 'product' },
  { shopify: 'PRODUCTVARIANT', ours: 'variant' },
  { shopify: 'COLLECTION', ours: 'collection' },
  { shopify: 'CUSTOMER', ours: 'customer' },
  { shopify: 'ORDER', ours: 'order' },
] as const
export type FieldOwner = (typeof FIELD_OWNERS)[number]

export type NOwnerDefinition = NFieldDefinition & { sourceId: string; namespace: string }

export type SettingsSource = {
  shop: NShopSettings
  locations: Read<NLocation[]> | null
  profiles: Read<NDeliveryProfile[]> | null
  policies: Read<NPolicy[]> | null
  fields: { owner: FieldOwner; read: Read<NOwnerDefinition[]> }[] | null
  segments: Read<NSegment[]> | null
  markets: Read<NMarket[]> | null
  purchaseOrders: Read<NPurchaseOrder[]> | null
  transfers: Read<NTransfer[]> | null
}

/* -------------------------------------------------------------------- shop */

const SHOP_SETTINGS_QUERY = `{ shop {
  name email contactEmail currencyCode ianaTimezone weightUnit taxesIncluded
  currencyFormats { moneyFormat }
  shopAddress { address1 address2 city province provinceCode countryCodeV2 zip phone }
} }`

const SHOP_FIELDS_QUERY = '{ shop { metafields(first: 100) { nodes { namespace key value } } } }'

type GShop = {
  name: string
  email: string
  contactEmail: string | null
  currencyCode: string
  ianaTimezone: string
  weightUnit: string
  taxesIncluded: boolean
  currencyFormats?: { moneyFormat: string | null } | null
  shopAddress: GAddress
}

type ShopExtras = { gstin: string | null; seo: { title: string; description: string } }

/**
 * What the shop keeps in its own extra fields: a GSTIN some app saved there, and the home page
 * title and meta description (Shopify stores Online Store › Preferences as `global.title_tag`
 * and `global.description_tag`) (audit #131).
 */
async function shopExtras(client: ShopifyClient): Promise<ShopExtras> {
  const out: ShopExtras = { gstin: null, seo: { title: '', description: '' } }
  try {
    const data = await client.query<{
      shop: { metafields: { nodes: { namespace: string; key: string; value: string }[] } }
    }>(SHOP_FIELDS_QUERY, {}, 20)
    for (const m of data.shop.metafields.nodes) {
      const value = m.value?.trim() ?? ''
      if (m.namespace === 'global' && m.key === 'title_tag') out.seo.title = value
      else if (m.namespace === 'global' && m.key === 'description_tag') out.seo.description = value
      else if (!out.gstin) {
        const check = validateGstin(value)
        if (check.ok) out.gstin = check.gstin
      }
    }
  } catch (err) {
    // Not every token may read the shop's extra fields; the GST number and SEO are then not known.
    if (!(err instanceof ShopifyError)) throw err
  }
  return out
}

async function fetchShop(client: ShopifyClient): Promise<NShopSettings> {
  const { shop } = await client.query<{ shop: GShop }>(SHOP_SETTINGS_QUERY, {}, 10)
  const extras = await shopExtras(client)
  return {
    name: shop.name.trim(),
    email: (shop.contactEmail || shop.email || '').trim(),
    address: shop.shopAddress ? mapAddress(shop.shopAddress) : null,
    currency: shop.currencyCode,
    timezone: shop.ianaTimezone,
    weightUnit: shop.weightUnit,
    taxesIncluded: shop.taxesIncluded,
    gstin: extras.gstin,
    moneyFormat: cleanMoneyFormat(shop.currencyFormats?.moneyFormat),
    seo: extras.seo,
  }
}

/* --------------------------------------------------------------- locations */

const LOCATIONS_QUERY = `query Locations($cursor: String) {
  locations(first: 100, after: $cursor, includeInactive: false) {
    ${PAGE_INFO}
    nodes {
      id name isActive fulfillsOnlineOrders isFulfillmentService
      address { address1 address2 city province provinceCode countryCode zip phone }
      localPickupSettingsV2 { pickupTime }
    }
  }
}`

type GLocation = {
  id: string
  name: string
  isActive: boolean
  fulfillsOnlineOrders: boolean
  isFulfillmentService: boolean
  address: GAddress
  localPickupSettingsV2: { pickupTime: string } | null
}

async function fetchLocations(client: ShopifyClient): Promise<NLocation[]> {
  const out: NLocation[] = []
  for await (const nodes of client.paginate<GLocation>(
    LOCATIONS_QUERY,
    (d) => (d as { locations: Page<GLocation> }).locations,
    {},
    120,
  )) {
    for (const l of nodes) {
      if (!l.isActive) continue
      out.push({
        sourceId: l.id,
        name: l.name.trim(),
        fulfillsOnlineOrders: l.fulfillsOnlineOrders,
        app: l.isFulfillmentService,
        localPickup: l.localPickupSettingsV2 !== null,
        address: mapAddress(l.address ?? {}),
      })
    }
  }
  return out
}

/* -------------------------------------------------------- policies, fields */

const POLICIES_QUERY = '{ shop { shopPolicies { type title body } } }'

async function fetchPolicies(client: ShopifyClient): Promise<NPolicy[]> {
  const data = await client.query<{ shop: { shopPolicies: NPolicy[] } }>(POLICIES_QUERY, {}, 10)
  return data.shop.shopPolicies.map((p) => ({ type: p.type, title: p.title.trim(), body: p.body }))
}

const SEGMENTS_QUERY = `query Segments($cursor: String) {
  segments(first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes { id name query }
  }
}`

async function fetchSegments(client: ShopifyClient): Promise<NSegment[]> {
  const out: NSegment[] = []
  let cursor: string | null = null
  for (let page = 0; page < 20; page++) {
    const data: {
      segments: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        nodes: { id: string; name: string; query: string }[]
      }
    } = await client.query(SEGMENTS_QUERY, { cursor }, 10)
    for (const n of data.segments.nodes) out.push({ sourceId: n.id, name: n.name, query: n.query })
    if (!data.segments.pageInfo.hasNextPage) break
    cursor = data.segments.pageInfo.endCursor
  }
  return out
}

// Markets as Shopify has had them since 2025-04: status, conditions and web presences.
const MARKETS_QUERY = `query Markets($cursor: String) {
  markets(first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name status
      conditions { regionsCondition { regions(first: 250) { nodes { ... on MarketRegionCountry { code } } } } }
      currencySettings { baseCurrency { currencyCode } }
      webPresences(first: 1) { nodes { subfolderSuffix defaultLocale { locale } alternateLocales { locale } } }
      catalogs(first: 1) { nodes { priceList { parent { adjustment { type value } } } } }
    }
  }
}`

type GMarket = {
  id: string
  name: string
  status: string
  conditions: {
    regionsCondition: { regions: { nodes: { code?: string | null }[] } } | null
  } | null
  currencySettings: { baseCurrency: { currencyCode: string } | null } | null
  webPresences: {
    nodes: {
      subfolderSuffix: string | null
      defaultLocale: { locale: string } | null
      alternateLocales: { locale: string }[] | null
    }[]
  } | null
  catalogs: {
    nodes: {
      priceList: { parent: { adjustment: { type: string; value: number } | null } | null } | null
    }[]
  } | null
}

/** A price list adjustment as basis points: `PERCENTAGE_DECREASE` 5 is −500. */
function adjustmentBp(a: { type: string; value: number } | null | undefined): number {
  if (!a || !Number.isFinite(a.value)) return 0
  const bp = Math.round(a.value * 100)
  return a.type === 'PERCENTAGE_DECREASE' ? -bp : bp
}

function mapMarket(m: GMarket): NMarket {
  const web = m.webPresences?.nodes[0]
  return {
    sourceId: m.id,
    name: m.name,
    active: m.status === 'ACTIVE',
    countries: (m.conditions?.regionsCondition?.regions.nodes ?? []).flatMap((r) =>
      r.code ? [r.code] : [],
    ),
    currency: m.currencySettings?.baseCurrency?.currencyCode ?? null,
    locale: web?.defaultLocale?.locale ?? null,
    locales: (web?.alternateLocales ?? []).map((l) => l.locale),
    subfolder: web?.subfolderSuffix ?? null,
    adjustmentBp: adjustmentBp(m.catalogs?.nodes[0]?.priceList?.parent?.adjustment),
  }
}

async function fetchMarkets(client: ShopifyClient): Promise<NMarket[]> {
  const out: NMarket[] = []
  let cursor: string | null = null
  for (let page = 0; page < 10; page++) {
    const data: {
      markets: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        nodes: GMarket[]
      }
    } = await client.query(MARKETS_QUERY, { cursor }, 50)
    out.push(...data.markets.nodes.map(mapMarket))
    if (!data.markets.pageInfo.hasNextPage) break
    cursor = data.markets.pageInfo.endCursor
  }
  return out
}

async function fetchOwnerDefinitions(
  client: ShopifyClient,
  owner: FieldOwner,
): Promise<NOwnerDefinition[]> {
  return (await definitionsOf(client, owner.shopify)).map((d) => ({
    ...mapFieldDefinition({ ...d, required: false }),
    sourceId: d.id,
    namespace: d.namespace,
  }))
}

/**
 * Read what the chosen parts need. The shop itself is always read (store details,
 * tax and the plan's header); when that fails the whole check fails, since the
 * connection is not working at all.
 */
export async function fetchSettingsSource(
  client: ShopifyClient,
  parts: readonly SettingsPart[],
): Promise<SettingsSource> {
  const wants = (...p: SettingsPart[]) => p.some((x) => parts.includes(x))
  const shop = await fetchShop(client)
  // Purchase orders and transfers read locations too, so a location this import creates counts.
  const locations = wants('locations', 'shipping', 'purchase_orders', 'transfers')
    ? await read(() => fetchLocations(client))
    : null
  const profiles = wants('shipping') ? await read(() => fetchProfiles(client)) : null
  const policies = wants('policies') ? await read(() => fetchPolicies(client)) : null
  let fields: SettingsSource['fields'] = null
  if (wants('fields')) {
    fields = []
    for (const owner of FIELD_OWNERS) {
      fields.push({ owner, read: await read(() => fetchOwnerDefinitions(client, owner)) })
    }
  }
  const segments = wants('segments') ? await read(() => fetchSegments(client)) : null
  const markets = wants('markets') ? await read(() => fetchMarkets(client)) : null
  const purchaseOrders = wants('purchase_orders')
    ? await read(() => fetchPurchaseOrders(client))
    : null
  const transfers = wants('transfers') ? await read(() => fetchTransfers(client)) : null
  return {
    shop,
    locations,
    profiles,
    policies,
    fields,
    segments,
    markets,
    purchaseOrders,
    transfers,
  }
}
