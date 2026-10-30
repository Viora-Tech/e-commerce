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
import type { SettingsPart } from './settings-client'
import type { NMarket } from './settings-plan-markets'
import type { NSegment } from './settings-plan-segments'
import type {
  NPurchaseOrder,
  NStockLine,
  NStockLocation,
  NTransfer,
} from './settings-plan-stock'
import { type ShopifyClient, ShopifyError } from './shopify-client'
import type { NFieldDefinition } from './types'

type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
const PAGE_INFO = 'pageInfo { hasNextPage endCursor }'

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

/* ----------------------------------------------------------------- helpers */

/** "50.00" rupees → 5000 paise. */
const paiseOf = (amount: string | number | null | undefined): number =>
  Math.round(Number(amount ?? 0) * 100)

const GRAMS_PER_UNIT: Record<string, number> = {
  GRAMS: 1,
  KILOGRAMS: 1000,
  OUNCES: 28.349523125,
  POUNDS: 453.59237,
}

type GAddress = {
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  provinceCode?: string | null
  countryCodeV2?: string | null
  countryCode?: string | null
  zip?: string | null
  phone?: string | null
} | null

function mapAddress(a: NonNullable<GAddress>): NSettingsAddress {
  return {
    line1: a.address1?.trim() ?? '',
    line2: a.address2?.trim() ?? '',
    city: a.city?.trim() ?? '',
    province: a.province?.trim() ?? '',
    provinceCode: a.provinceCode?.trim() ?? '',
    countryCode: (a.countryCodeV2 ?? a.countryCode ?? '').trim().toUpperCase(),
    zip: a.zip?.trim() ?? '',
    phone: a.phone?.trim() ?? '',
  }
}

async function read<T>(load: () => Promise<T>): Promise<Read<T>> {
  try {
    return { ok: true, data: await load() }
  } catch (err) {
    if (err instanceof ShopifyError) {
      return { ok: false, access: err.kind === 'scope', error: err.message }
    }
    throw err
  }
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

/* ---------------------------------------------------------------- shipping */

const PROFILES_QUERY = `query DeliveryProfiles($cursor: String) {
  deliveryProfiles(first: 50, after: $cursor) { ${PAGE_INFO} nodes { id name default } }
}`

/** One page of a profile's zones; `$group` pages one location group past its first page. */
const PROFILE_ZONES_QUERY = `query DeliveryProfileZones($id: ID!, $group: ID, $cursor: String) {
  deliveryProfile(id: $id) {
    profileLocationGroups(locationGroupId: $group) {
      locationGroup { id }
      locationGroupZones(first: 10, after: $cursor) {
        ${PAGE_INFO}
        nodes {
          zone { id name countries { code { countryCode restOfWorld } provinces { name code } } }
          methodDefinitions(first: 40) {
            nodes {
              id name active
              rateProvider {
                __typename
                ... on DeliveryRateDefinition { price { amount currencyCode } }
                ... on DeliveryParticipant { carrierService { name } }
              }
              methodConditions {
                field operator
                conditionCriteria {
                  __typename
                  ... on MoneyV2 { amount currencyCode }
                  ... on Weight { unit value }
                }
              }
            }
          }
        }
      }
    }
  }
}`

/** The products of a custom profile, a page at a time. */
const PROFILE_ITEMS_QUERY = `query DeliveryProfileItems($id: ID!, $cursor: String) {
  deliveryProfile(id: $id) {
    profileItems(first: 250, after: $cursor) { ${PAGE_INFO} nodes { product { id } } }
  }
}`

type GCondition = {
  field: string
  operator: string
  conditionCriteria:
    | { __typename: 'MoneyV2'; amount: string; currencyCode: string }
    | { __typename: 'Weight'; unit: string; value: number }
}

type GMethod = {
  id: string
  name: string
  active: boolean
  rateProvider:
    | { __typename: 'DeliveryRateDefinition'; price: { amount: string; currencyCode: string } }
    | { __typename: 'DeliveryParticipant'; carrierService: { name: string | null } | null }
  methodConditions: GCondition[]
}

type GZone = {
  zone: {
    id: string
    name: string
    countries: {
      code: { countryCode: string | null; restOfWorld: boolean }
      provinces: { name: string; code: string }[]
    }[]
  }
  methodDefinitions: { nodes: GMethod[] }
}

type GLocationGroup = {
  locationGroup: { id: string }
  locationGroupZones: Page<GZone>
}

function mapCondition(c: GCondition): NRateCondition | null {
  const operator =
    c.operator === 'GREATER_THAN_OR_EQUAL_TO'
      ? 'min'
      : c.operator === 'LESS_THAN_OR_EQUAL_TO'
        ? 'max'
        : null
  if (!operator) return null
  const v = c.conditionCriteria
  if (c.field === 'TOTAL_PRICE' && v.__typename === 'MoneyV2') {
    return { field: 'price', operator, amount: paiseOf(v.amount), currency: v.currencyCode }
  }
  if (c.field === 'TOTAL_WEIGHT' && v.__typename === 'Weight') {
    return { field: 'weight', operator, grams: Math.round(v.value * (GRAMS_PER_UNIT[v.unit] ?? 1)) }
  }
  return null
}

function mapMethod(m: GMethod): NDeliveryMethod {
  const rate = m.rateProvider.__typename === 'DeliveryRateDefinition' ? m.rateProvider : null
  const carrier = m.rateProvider.__typename === 'DeliveryParticipant' ? m.rateProvider : null
  return {
    sourceId: m.id,
    name: m.name.trim(),
    active: m.active,
    price: rate ? { amount: paiseOf(rate.price.amount), currency: rate.price.currencyCode } : null,
    carrier: carrier ? (carrier.carrierService?.name ?? m.name) : null,
    conditions: m.methodConditions.flatMap((c) => {
      const mapped = mapCondition(c)
      return mapped ? [mapped] : []
    }),
  }
}

function mapZone(z: GZone): NDeliveryZone {
  return {
    sourceId: z.zone.id,
    name: z.zone.name.trim(),
    countries: z.zone.countries.map((c) => ({
      code: c.code.countryCode,
      restOfWorld: c.code.restOfWorld,
      provinces: c.provinces,
    })),
    methods: z.methodDefinitions.nodes.map(mapMethod),
  }
}

async function profileZones(client: ShopifyClient, id: string): Promise<NDeliveryZone[]> {
  const pick = (d: unknown) =>
    (d as { deliveryProfile: { profileLocationGroups: GLocationGroup[] } | null }).deliveryProfile
      ?.profileLocationGroups ?? []
  const zones: NDeliveryZone[] = []
  const groups = pick(await client.query<unknown>(PROFILE_ZONES_QUERY, { id }, 600))
  for (const group of groups) {
    zones.push(...group.locationGroupZones.nodes.map(mapZone))
    let page = group.locationGroupZones.pageInfo
    while (page.hasNextPage && page.endCursor) {
      const [next] = pick(
        await client.query<unknown>(
          PROFILE_ZONES_QUERY,
          { id, group: group.locationGroup.id, cursor: page.endCursor },
          600,
        ),
      )
      if (!next) break
      zones.push(...next.locationGroupZones.nodes.map(mapZone))
      page = next.locationGroupZones.pageInfo
    }
  }
  return zones
}

async function profileProducts(client: ShopifyClient, id: string): Promise<string[]> {
  const ids: string[] = []
  for await (const nodes of client.paginate<{ product: { id: string } | null }>(
    PROFILE_ITEMS_QUERY,
    (d) =>
      (d as { deliveryProfile: { profileItems: Page<{ product: { id: string } | null }> } | null })
        .deliveryProfile?.profileItems ?? {
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    { id },
    260,
  )) {
    for (const n of nodes) if (n.product) ids.push(n.product.id)
  }
  return ids
}

async function fetchProfiles(client: ShopifyClient): Promise<NDeliveryProfile[]> {
  const out: NDeliveryProfile[] = []
  for await (const nodes of client.paginate<{ id: string; name: string; default: boolean }>(
    PROFILES_QUERY,
    (d) =>
      (d as { deliveryProfiles: Page<{ id: string; name: string; default: boolean }> })
        .deliveryProfiles,
    {},
    60,
  )) {
    for (const p of nodes) {
      // The default profile becomes General; a custom one becomes a shipping profile here,
      // with its products (matched to the products the import brought over).
      out.push({
        sourceId: p.id,
        name: p.name.trim(),
        default: p.default,
        zones: await profileZones(client, p.id),
        productIds: p.default ? [] : await profileProducts(client, p.id),
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

/* ------------------------------------------------ purchase orders, transfers */

/*
 * Purchase orders and transfers, Admin API 2026-10 (verified against shopify.dev on 2026-10-31
 * and validated against the 2026-10 schema):
 *  - https://shopify.dev/docs/api/admin-graphql/2026-10/queries/inventoryPurchaseOrders
 *    needs `read_inventory_purchase_orders` (read_inventory no longer covers purchase orders:
 *    https://shopify.dev/changelog/purchase-order-read-api). Statuses DRAFT and ORDERED, plus
 *    `archivedAt`. Lines give `totalQuantity` and `unitCost` but no received count; receipts
 *    are the linked `transfers`.
 *  - https://shopify.dev/docs/api/admin-graphql/2026-10/queries/inventoryTransfers needs
 *    `read_inventory_transfers`. Statuses DRAFT, READY_TO_SHIP, IN_PROGRESS, TRANSFERRED,
 *    CANCELED, OTHER. Origin and destination are `LocationSnapshot`s whose `location` is null
 *    once the location is deleted.
 *  - Lines name an `inventoryItem`, whose `variant` gives the product to match through the
 *    products import.
 */
const STOCK_LINE_VARIANT = 'inventoryItem { variant { sku title product { id } } }'
const PO_LINE_FIELDS = `totalQuantity title unitCost { amount } ${STOCK_LINE_VARIANT}`
const TRANSFER_LINE_FIELDS = `totalQuantity title ${STOCK_LINE_VARIANT}`

const PURCHASE_ORDERS_QUERY = `query PurchaseOrders($cursor: String) {
  inventoryPurchaseOrders(first: 25, after: $cursor) {
    ${PAGE_INFO}
    nodes {
      id name status currency orderedAt archivedAt
      origin { supplierName }
      destination { name location { id } }
      transfers(first: 10) { nodes { receivedQuantity } }
      lineItems(first: 100) { ${PAGE_INFO} nodes { ${PO_LINE_FIELDS} } }
    }
  }
}`

const PURCHASE_ORDER_LINES_QUERY = `query PurchaseOrderLines($id: ID!, $cursor: String) {
  inventoryPurchaseOrder(id: $id) {
    lineItems(first: 100, after: $cursor) { ${PAGE_INFO} nodes { ${PO_LINE_FIELDS} } }
  }
}`

const TRANSFERS_QUERY = `query Transfers($cursor: String) {
  inventoryTransfers(first: 25, after: $cursor) {
    ${PAGE_INFO}
    nodes {
      id name status note dateCreated
      origin { name location { id } }
      destination { name location { id } }
      lineItems(first: 100) { ${PAGE_INFO} nodes { ${TRANSFER_LINE_FIELDS} } }
    }
  }
}`

const TRANSFER_LINES_QUERY = `query TransferLines($id: ID!, $cursor: String) {
  inventoryTransfer(id: $id) {
    lineItems(first: 100, after: $cursor) { ${PAGE_INFO} nodes { ${TRANSFER_LINE_FIELDS} } }
  }
}`

type GStockLine = {
  totalQuantity: number
  title: string | null
  unitCost?: { amount: string } | null
  inventoryItem: {
    variant: { sku: string | null; title: string | null; product: { id: string } | null } | null
  } | null
}
type GLocationSnapshot = { name: string; location: { id: string } | null } | null

type GPurchaseOrder = {
  id: string
  name: string
  status: string
  currency: string
  orderedAt: string | null
  archivedAt: string | null
  origin: { supplierName: string | null } | null
  destination: GLocationSnapshot
  transfers: { nodes: { receivedQuantity: number }[] } | null
  lineItems: Page<GStockLine>
}

type GTransfer = {
  id: string
  name: string
  status: string
  note: string | null
  dateCreated: string | null
  origin: GLocationSnapshot
  destination: GLocationSnapshot
  lineItems: Page<GStockLine>
}

const stockLocation = (l: GLocationSnapshot): NStockLocation | null =>
  l ? { sourceId: l.location?.id ?? null, name: l.name } : null

function stockLine(l: GStockLine): NStockLine {
  const v = l.inventoryItem?.variant ?? null
  return {
    productSourceId: v?.product?.id ?? null,
    sku: v?.sku ?? null,
    variantTitle: v?.title ?? null,
    title: l.title ?? '',
    quantity: l.totalQuantity,
    unitCost: l.unitCost?.amount ?? null,
  }
}

/** Every line of one record: the first page came with it, the rest are read by its id. */
async function allLines(
  client: ShopifyClient,
  first: Page<GStockLine>,
  query: string,
  pick: (data: unknown) => Page<GStockLine> | undefined,
  id: string,
): Promise<GStockLine[]> {
  const out = [...first.nodes]
  let page = first.pageInfo
  // Our documents hold up to 500 lines; past that the save refuses it anyway.
  while (page.hasNextPage && page.endCursor && out.length < 600) {
    const next = pick(await client.query<unknown>(query, { id, cursor: page.endCursor }, 100))
    if (!next) break
    out.push(...next.nodes)
    page = next.pageInfo
  }
  return out
}

async function fetchPurchaseOrders(client: ShopifyClient): Promise<NPurchaseOrder[]> {
  const out: NPurchaseOrder[] = []
  for await (const nodes of client.paginate<GPurchaseOrder>(
    PURCHASE_ORDERS_QUERY,
    (d) => (d as { inventoryPurchaseOrders: Page<GPurchaseOrder> }).inventoryPurchaseOrders,
    {},
    300,
  )) {
    for (const po of nodes) {
      const lines = await allLines(
        client,
        po.lineItems,
        PURCHASE_ORDER_LINES_QUERY,
        (d) =>
          (d as { inventoryPurchaseOrder: { lineItems: Page<GStockLine> } | null })
            .inventoryPurchaseOrder?.lineItems,
        po.id,
      )
      out.push({
        sourceId: po.id,
        name: po.name,
        status: po.status,
        archived: po.archivedAt !== null,
        currency: po.currency,
        supplierName: po.origin?.supplierName ?? null,
        destination: stockLocation(po.destination),
        orderedAt: po.orderedAt,
        received: (po.transfers?.nodes ?? []).some((t) => t.receivedQuantity > 0),
        lines: lines.map(stockLine),
      })
    }
  }
  return out
}

async function fetchTransfers(client: ShopifyClient): Promise<NTransfer[]> {
  const out: NTransfer[] = []
  for await (const nodes of client.paginate<GTransfer>(
    TRANSFERS_QUERY,
    (d) => (d as { inventoryTransfers: Page<GTransfer> }).inventoryTransfers,
    {},
    300,
  )) {
    for (const t of nodes) {
      const lines = await allLines(
        client,
        t.lineItems,
        TRANSFER_LINES_QUERY,
        (d) =>
          (d as { inventoryTransfer: { lineItems: Page<GStockLine> } | null }).inventoryTransfer
            ?.lineItems,
        t.id,
      )
      out.push({
        sourceId: t.id,
        name: t.name,
        status: t.status,
        note: t.note,
        createdAt: t.dateCreated,
        origin: stockLocation(t.origin),
        destination: stockLocation(t.destination),
        lines: lines.map(stockLine),
      })
    }
  }
  return out
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
