/** Delivery profiles with their zones, rates and products from the Admin API for the store settings import, mapped for the planner. */

import type {
  NDeliveryMethod,
  NDeliveryProfile,
  NDeliveryZone,
  NRateCondition,
} from './api-settings'
import { GRAMS_PER_UNIT, PAGE_INFO, type Page, paiseOf } from './api-settings-read'
import type { ShopifyClient } from './shopify-client'

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

export async function fetchProfiles(client: ShopifyClient): Promise<NDeliveryProfile[]> {
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
