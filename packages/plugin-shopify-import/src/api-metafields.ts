/**
 * Shopify metafields: definitions per owner type, every value on products and
 * collections (one Bulk Operation when Shopify allows it, paged otherwise),
 * and for the owners we cannot hold yet only how many values they carry.
 */
import { type GFieldDefinition, mapFieldDefinition } from './api-metaobjects'
import { reassembleBulkStream, runBulkQuery, streamJsonl } from './bulk'
import type { ShopifyClient } from './shopify-client'
import type { MetafieldOwner, NMetafieldDefinition, NOwnerMetafields } from './types'

type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
const PAGE_INFO = 'pageInfo { hasNextPage endCursor }'

const METAFIELD_DEFINITIONS_QUERY = `query MetafieldDefinitions($ownerType: MetafieldOwnerType!, $cursor: String) {
  metafieldDefinitions(ownerType: $ownerType, first: 100, after: $cursor) {
    ${PAGE_INFO}
    nodes { id namespace key metafieldsCount name description type { name } validations { name value } }
  }
}`

type GMetafieldDefinition = Omit<GFieldDefinition, 'required'> & {
  id: string
  namespace: string
  metafieldsCount: number
}

async function definitionsOf(client: ShopifyClient, ownerType: string) {
  const out: GMetafieldDefinition[] = []
  for await (const nodes of client.paginate<GMetafieldDefinition>(
    METAFIELD_DEFINITIONS_QUERY,
    (d) => (d as { metafieldDefinitions: Page<GMetafieldDefinition> }).metafieldDefinitions,
    { ownerType },
    120,
  )) {
    out.push(...nodes)
  }
  return out
}

export async function fetchMetafieldDefinitions(
  client: ShopifyClient,
  ownerType: MetafieldOwner,
): Promise<NMetafieldDefinition[]> {
  return (await definitionsOf(client, ownerType)).map((d) => ({
    ...mapFieldDefinition({ ...d, required: false }),
    sourceId: d.id,
    ownerType,
    namespace: d.namespace,
  }))
}

/** Owners whose extra fields we cannot hold yet; the report counts their values. */
const OTHER_METAFIELD_OWNERS = [
  'PRODUCTVARIANT',
  'CUSTOMER',
  'ORDER',
  'PAGE',
  'ARTICLE',
  'BLOG',
  'SHOP',
  'LOCATION',
  'COMPANY',
] as const

/**
 * How many defined values each other owner type carries. An owner type the
 * token may not read (or Shopify does not know) is left out rather than
 * failing the import.
 */
export async function countOtherMetafields(
  client: ShopifyClient,
  onSkip: (ownerType: string, reason: unknown) => void,
): Promise<{ ownerType: string; definitions: number; values: number }[]> {
  const out: { ownerType: string; definitions: number; values: number }[] = []
  for (const ownerType of OTHER_METAFIELD_OWNERS) {
    try {
      const defs = await definitionsOf(client, ownerType)
      const values = defs.reduce((sum, d) => sum + (d.metafieldsCount ?? 0), 0)
      if (defs.length) out.push({ ownerType, definitions: defs.length, values })
    } catch (err) {
      onSkip(ownerType, err)
    }
  }
  return out
}

/* ------------------------------------------------------------- values */

const CONNECTION = { PRODUCT: 'products', COLLECTION: 'collections' } as const
const SINGLE = { PRODUCT: 'product', COLLECTION: 'collection' } as const
const VALUE_FIELDS = 'namespace key type value'

type GValue = { namespace: string; key: string; type: string; value: string | null }
type GOwner = { id: string; handle: string; metafields: Page<GValue> }

const ownerValuesQuery = (owner: MetafieldOwner) => `query OwnerMetafields($cursor: String) {
  ${CONNECTION[owner]}(first: 15, after: $cursor, sortKey: ID) {
    ${PAGE_INFO}
    nodes { id handle metafields(first: 50) { ${PAGE_INFO} nodes { ${VALUE_FIELDS} } } }
  }
}`

const moreValuesQuery = (
  owner: MetafieldOwner,
) => `query MoreOwnerMetafields($id: ID!, $cursor: String) {
  ${SINGLE[owner]}(id: $id) { metafields(first: 100, after: $cursor) { ${PAGE_INFO} nodes { ${VALUE_FIELDS} } } }
}`

const ownerValuesBulkQuery = (owner: MetafieldOwner) => `{
  ${CONNECTION[owner]} {
    edges { node { id handle metafields { edges { node { id ${VALUE_FIELDS} } } } } }
  }
}`

const toOwner = (owner: MetafieldOwner, o: GOwner, values: GValue[]): NOwnerMetafields => ({
  ownerType: owner,
  ownerSourceId: o.id,
  handle: o.handle,
  metafields: values.map((v) => ({
    namespace: v.namespace,
    key: v.key,
    type: v.type,
    value: v.value,
  })),
})

async function* valuesPaged(
  client: ShopifyClient,
  owner: MetafieldOwner,
): AsyncGenerator<NOwnerMetafields[]> {
  for await (const nodes of client.paginate<GOwner>(
    ownerValuesQuery(owner),
    (d) => (d as Record<string, Page<GOwner>>)[CONNECTION[owner]] as Page<GOwner>,
    {},
    900,
  )) {
    const batch: NOwnerMetafields[] = []
    for (const o of nodes) {
      const values = [...o.metafields.nodes]
      if (o.metafields.pageInfo.hasNextPage) {
        for await (const more of client.paginate<GValue>(
          moreValuesQuery(owner),
          (d) =>
            (d as Record<string, { metafields: Page<GValue> }>)[SINGLE[owner]]
              ?.metafields as Page<GValue>,
          { id: o.id },
          110,
          o.metafields.pageInfo.endCursor,
        )) {
          values.push(...more)
        }
      }
      batch.push(toOwner(owner, o, values))
    }
    yield batch
  }
}

const BULK_BATCH_SIZE = 50

/** Every product's (or collection's) metafields, one bulk operation first, paged on fallback. */
export async function* fetchOwnerMetafields(
  client: ShopifyClient,
  owner: MetafieldOwner,
  onBulkFallback?: (reason: unknown) => void,
): AsyncGenerator<NOwnerMetafields[]> {
  let owners: NOwnerMetafields[] | null = null
  try {
    const url = await runBulkQuery(client, ownerValuesBulkQuery(owner))
    const nodes = url
      ? await reassembleBulkStream<GOwner>(
          streamJsonl(url, client.fetchImpl),
          (type) => (type === 'Metafield' ? { field: 'metafields', asPage: true } : null),
          [{ field: 'metafields', asPage: true }],
        )
      : []
    owners = nodes.map((o) => toOwner(owner, o, o.metafields.nodes))
  } catch (err) {
    onBulkFallback?.(err)
  }
  if (!owners) {
    yield* valuesPaged(client, owner)
    return
  }
  for (let i = 0; i < owners.length; i += BULK_BATCH_SIZE) {
    yield owners.slice(i, i + BULK_BATCH_SIZE)
  }
}
