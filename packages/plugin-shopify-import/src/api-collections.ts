/** Collections from the Admin GraphQL API, smart rules mapped onto ours. */
import type { CollectionCondition, CollectionOp, CollectionRules } from '@commerce/db'
import { PAGE_INFO, type Page, templateSuffix } from './shopify-api'
import type { ShopifyClient } from './shopify-client'
import type { NCollection } from './types'

const COLLECTIONS_QUERY = `query Collections($cursor: String, $query: String) {
  collections(first: 15, after: $cursor, sortKey: ID, query: $query) {
    ${PAGE_INFO}
    nodes {
      id handle title descriptionHtml sortOrder templateSuffix
      image { url altText }
      seo { title description }
      ruleSet { appliedDisjunctively rules { column relation condition } }
      products(first: 100) { ${PAGE_INFO} nodes { handle } }
    }
  }
}`

const COLLECTION_PRODUCTS_QUERY = `query CollectionProducts($id: ID!, $cursor: String) {
  collection(id: $id) { products(first: 250, after: $cursor) { ${PAGE_INFO} nodes { handle } } }
}`

type GCollection = {
  id: string
  handle: string
  title: string
  descriptionHtml: string | null
  sortOrder: string | null
  templateSuffix: string | null
  image: { url: string; altText: string | null } | null
  seo: { title: string | null; description: string | null } | null
  ruleSet: {
    appliedDisjunctively: boolean
    rules: { column: string; relation: string; condition: string }[]
  } | null
  products: Page<{ handle: string }>
}

const RULE_FIELDS: Record<string, CollectionCondition['field']> = {
  TITLE: 'title',
  TYPE: 'type',
  VENDOR: 'vendor',
  TAG: 'tag',
  VARIANT_PRICE: 'price',
}
const RULE_OPS: Record<string, CollectionOp> = {
  EQUALS: 'eq',
  NOT_EQUALS: 'neq',
  CONTAINS: 'contains',
  STARTS_WITH: 'starts_with',
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
}
const ALLOWED: Record<CollectionCondition['field'], CollectionOp[]> = {
  title: ['eq', 'neq', 'contains', 'starts_with'],
  type: ['eq', 'neq', 'contains'],
  vendor: ['eq', 'neq', 'contains'],
  tag: ['eq', 'neq'],
  price: ['gt', 'lt', 'eq'],
}

/** Shopify smart rules → ours, plus the ones we cannot express. */
function mapRules(ruleSet: GCollection['ruleSet']): {
  rules: CollectionRules | null
  unmapped: string[]
} {
  if (!ruleSet || ruleSet.rules.length === 0) return { rules: null, unmapped: [] }
  const conditions: CollectionCondition[] = []
  const unmapped: string[] = []
  for (const r of ruleSet.rules) {
    const field = RULE_FIELDS[r.column]
    const op = RULE_OPS[r.relation]
    if (!field || !op || !ALLOWED[field].includes(op)) {
      unmapped.push(`${r.column.toLowerCase()} ${r.relation.toLowerCase()} ${r.condition}`)
      continue
    }
    conditions.push({ field, op, value: r.condition })
  }
  return {
    rules: { match: ruleSet.appliedDisjunctively ? 'any' : 'all', conditions },
    unmapped,
  }
}

export async function* fetchCollections(
  client: ShopifyClient,
  search: string | null = null,
): AsyncGenerator<NCollection[]> {
  for await (const nodes of client.paginate<GCollection>(
    COLLECTIONS_QUERY,
    (d) => (d as { collections: Page<GCollection> }).collections,
    { query: search },
    900,
  )) {
    const batch: NCollection[] = []
    for (const c of nodes) {
      const handles = c.products.nodes.map((p) => p.handle)
      const { rules, unmapped } = mapRules(c.ruleSet)
      // Membership matters for manual collections and for smart ones we fall back on.
      if (c.products.pageInfo.hasNextPage && (!rules || unmapped.length)) {
        for await (const more of client.paginate<{ handle: string }>(
          COLLECTION_PRODUCTS_QUERY,
          (d) => (d as { collection: { products: Page<{ handle: string }> } }).collection.products,
          { id: c.id },
          300,
          c.products.pageInfo.endCursor,
        )) {
          for (const p of more) if (!handles.includes(p.handle)) handles.push(p.handle)
        }
      }
      batch.push({
        sourceId: c.id,
        handle: c.handle,
        title: c.title,
        bodyHtml: c.descriptionHtml || null,
        image: c.image ? { src: c.image.url, alt: c.image.altText, position: 1 } : null,
        seoTitle: c.seo?.title || null,
        seoDescription: c.seo?.description || null,
        sortOrder: c.sortOrder,
        rules,
        unmappedRules: unmapped,
        productHandles: handles,
        published: true,
        templateSuffix: templateSuffix(c.templateSuffix),
      })
    }
    yield batch
  }
}
