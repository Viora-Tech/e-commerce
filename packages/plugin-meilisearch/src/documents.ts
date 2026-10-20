import { synonymsMap } from './settings'

/**
 * What the search index holds for one product, and how Meilisearch ranks it. Pure: the server
 * reads the rows, these only shape them. The index only finds and orders products; the
 * storefront loads prices, stock and photos from Postgres by id, so a stale document can never
 * show a wrong price or sell what is gone.
 */

/** One product as `server.ts` reads it from Postgres. */
export type ProductSource = {
  id: string
  handle: string
  title: string
  vendor: string | null
  productType: string | null
  tags: readonly string[]
  /** Lexical JSON, or a legacy plain string. */
  description: unknown
  skus: readonly (string | null)[]
  optionValues: readonly string[]
  /** Handles of the collections the product is in. */
  collections: readonly string[]
  minPricePaise: number | null
  maxPricePaise: number | null
  available: boolean
  createdAt: Date | string
  image: string | null
}

export type ProductDocument = {
  id: string
  handle: string
  title: string
  vendor: string
  type: string
  tags: string[]
  skus: string[]
  options: string[]
  description: string
  collections: string[]
  min_price: number | null
  max_price: number | null
  available: boolean
  /** Seconds since 1970, so it sorts. */
  created_at: number
  image: string | null
}

/** Enough description to match on; the rest only slows indexing. */
const DESCRIPTION_CHARS = 2_000

/**
 * The plain text of a description: every Lexical text node in order, block by block, or a
 * legacy plain string with any HTML tags dropped.
 */
export function plainText(description: unknown): string {
  const parts: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { text?: unknown; children?: unknown; root?: unknown }
    if (typeof n.text === 'string') parts.push(n.text)
    if (n.root) walk(n.root)
    if (Array.isArray(n.children)) {
      for (const child of n.children) walk(child)
      parts.push(' ')
    }
  }
  if (typeof description === 'string') {
    const trimmed = description.trim()
    if (trimmed.startsWith('{')) {
      try {
        walk(JSON.parse(trimmed))
      } catch {
        parts.push(trimmed)
      }
    } else parts.push(trimmed.replace(/<[^>]*>/g, ' '))
  } else walk(description)
  return parts.join('').replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_CHARS)
}

const uniq = (values: readonly (string | null | undefined)[]): string[] => [
  ...new Set(values.map((v) => (v ?? '').trim()).filter(Boolean)),
]

export function toDocument(p: ProductSource): ProductDocument {
  const created = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt)
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    vendor: p.vendor?.trim() ?? '',
    type: p.productType?.trim() ?? '',
    tags: uniq(p.tags),
    skus: uniq(p.skus),
    options: uniq(p.optionValues),
    description: plainText(p.description),
    collections: uniq(p.collections),
    min_price: p.minPricePaise,
    max_price: p.maxPricePaise,
    available: p.available,
    created_at: Number.isNaN(created.getTime()) ? 0 : Math.floor(created.getTime() / 1000),
    image: p.image,
  }
}

/**
 * The index settings. Searchable attributes in rank order: the title first, then vendor, type
 * and tags, then SKUs and option values ("XL", "Black"), the description last (Meilisearch's
 * `attribute` rule weighs a match by this order). Typo tolerance on, except on SKUs and handles,
 * where a typo is a different product. Filters and sorts cover the storefront's facets.
 */
export function indexSettings(synonyms: readonly (readonly string[])[]) {
  return {
    searchableAttributes: [
      'title',
      'vendor',
      'type',
      'tags',
      'skus',
      'options',
      'handle',
      'collections',
      'description',
    ],
    displayedAttributes: ['id', 'handle', 'title'],
    filterableAttributes: [
      'available',
      'min_price',
      'max_price',
      'vendor',
      'type',
      'tags',
      'collections',
    ],
    sortableAttributes: ['min_price', 'created_at', 'title'],
    rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
      disableOnAttributes: ['skus', 'handle'],
    },
    synonyms: synonymsMap(synonyms),
    pagination: { maxTotalHits: 1000 },
  }
}

export type IndexSettings = ReturnType<typeof indexSettings>
