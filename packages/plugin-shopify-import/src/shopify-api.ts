/**
 * Admin GraphQL queries and their mapping onto the importer's normalised
 * shapes. Page sizes keep each query under Shopify's 1,000-point cost ceiling;
 * nested connections that can run longer (variants, collection products) are
 * paged separately.
 */
import { bulkOrPaged, runBulkQuery, streamBulkRoots, streamJsonl } from './bulk'
import { asGiftCardVariants, giftCardFrom } from './gift-card-products'
import type { ShopifyClient } from './shopify-client'
import type { NProduct, NVariant } from './types'

export type Money = { shopMoney: { amount: string } } | null | undefined
export type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }

export const money = (m: Money): number => Math.round(Number(m?.shopMoney.amount ?? 0) * 100)
const rupees = (v: string | null | undefined): number | null =>
  v === null || v === undefined || v === '' ? null : Math.round(Number(v) * 100)

export const PAGE_INFO = 'pageInfo { hasNextPage endCursor }'

export const SHOP_QUERY = '{ shop { name myshopifyDomain } }'

/** Scopes actually granted to the token, not just what the app declares. */
const SCOPES_QUERY = '{ shop { name } currentAppInstallation { accessScopes { handle } } }'

export async function fetchShopAndScopes(
  client: ShopifyClient,
): Promise<{ shopName: string; scopes: string[] }> {
  const data = await client.query<{
    shop: { name: string }
    currentAppInstallation: { accessScopes: { handle: string }[] }
  }>(SCOPES_QUERY)
  return {
    shopName: data.shop.name,
    scopes: data.currentAppInstallation.accessScopes.map((s) => s.handle),
  }
}
/* ---------------------------------------------------------------- products */

const VARIANT_FIELDS = `id title sku barcode price compareAtPrice taxable inventoryQuantity inventoryPolicy availableForSale
  selectedOptions { name value } image { url }
  inventoryItem { tracked harmonizedSystemCode unitCost { amount } measurement { weight { unit value } } }`

/**
 * Only used when the Bulk Operations path (`fetchProducts` below) is
 * unavailable. Sized against the calculated-cost bucket rather than kept
 * artificially small: `ShopifyClient.query` already waits out the bucket
 * before an expensive page (see `shopify-client.ts`), so a bigger page that
 * spends more of the budget per round trip beats many tiny ones.
 */
export const PRODUCTS_QUERY = `query Products($cursor: String, $query: String) {
  products(first: 25, after: $cursor, sortKey: ID, query: $query) {
    ${PAGE_INFO}
    nodes {
      id handle title descriptionHtml vendor productType tags status templateSuffix publishedAt isGiftCard
      seo { title description }
      options { name position }
      hsn: metafield(namespace: "custom", key: "hsn") { value }
      media(first: 25) { nodes { ... on MediaImage { alt image { url altText } } } }
      variants(first: 75) { ${PAGE_INFO} nodes { ${VARIANT_FIELDS} } }
    }
  }
}`

export const PRODUCT_VARIANTS_QUERY = `query Variants($id: ID!, $cursor: String) {
  product(id: $id) { variants(first: 100, after: $cursor) { ${PAGE_INFO} nodes { ${VARIANT_FIELDS} } } }
}`

type GVariant = {
  id: string
  title: string
  sku: string | null
  barcode: string | null
  price: string
  compareAtPrice: string | null
  taxable: boolean
  inventoryQuantity: number | null
  /** `CONTINUE` keeps selling at zero stock: how Shopify pre-order apps sell past stock. */
  inventoryPolicy?: 'DENY' | 'CONTINUE' | null
  /** False when Shopify will not sell it (sold out with "stop selling", or unavailable). */
  availableForSale?: boolean | null
  selectedOptions: { name: string; value: string }[]
  image: { url: string } | null
  inventoryItem: {
    tracked: boolean
    harmonizedSystemCode: string | null
    unitCost: { amount: string } | null
    measurement: { weight: { unit: string; value: number } | null } | null
  } | null
}

type GProduct = {
  id: string
  handle: string
  title: string
  descriptionHtml: string | null
  vendor: string | null
  productType: string | null
  tags: string[]
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  /** When it went on the Online Store; null while it is not on that sales channel. */
  publishedAt?: string | null
  templateSuffix: string | null
  /** Shopify's gift card flag; optional so an older fixture without it still maps. */
  isGiftCard?: boolean | null
  seo: { title: string | null; description: string | null } | null
  options: { name: string; position: number }[]
  hsn: { value: string } | null
  media: {
    nodes: (
      | { alt: string | null; image: { url: string; altText: string | null } | null }
      | Record<string, never>
    )[]
  }
  variants: Page<GVariant>
}

const GRAMS: Record<string, number> = {
  GRAMS: 1,
  KILOGRAMS: 1000,
  OUNCES: 28.349523125,
  POUNDS: 453.59237,
}

function hsnDigits(value: string | null | undefined): string | null {
  const d = (value ?? '').replace(/\D/g, '')
  return d.length >= 4 && d.length <= 8 ? d : null
}

/**
 * Shopify's `templateSuffix` (`about` for `page.about.json`), kept only in the shape our
 * template keys allow; anything else (or none) is the default template.
 */
export function templateSuffix(value: string | null | undefined): string | null {
  const s = (value ?? '').trim().toLowerCase()
  return /^[a-z0-9-]{1,40}$/.test(s) ? s : null
}

export function mapVariant(
  v: GVariant,
  optionNames: string[],
  productHsn: string | null,
): NVariant {
  const byName = new Map(v.selectedOptions.map((o) => [o.name, o.value]))
  const weight = v.inventoryItem?.measurement?.weight
  return {
    sourceId: v.id,
    optionValues: optionNames.map((n) => byName.get(n) ?? ''),
    sku: v.sku || null,
    barcode: v.barcode || null,
    pricePaise: rupees(v.price) ?? 0,
    mrpPaise: rupees(v.compareAtPrice),
    costPaise: rupees(v.inventoryItem?.unitCost?.amount),
    taxable: v.taxable,
    trackInventory: v.inventoryItem?.tracked ?? true,
    weightGrams: weight ? Math.round(weight.value * (GRAMS[weight.unit] ?? 1)) : null,
    onHand: v.inventoryItem?.tracked === false ? null : Math.max(0, v.inventoryQuantity ?? 0),
    hsCode: hsnDigits(v.inventoryItem?.harmonizedSystemCode) ?? productHsn,
    imageSrc: v.image?.url ?? null,
    sellsOutOfStock: v.inventoryPolicy === 'CONTINUE',
    // A sold-out variant with a real price stays visible as sold out; only the ₹0 ones Shopify
    // would not sell are the "unavailable" leftovers (#934).
    hiddenOnStore: v.availableForSale === false && (rupees(v.price) ?? 0) === 0,
  }
}

/**
 * Our status for a Shopify product. An active product not on the Online Store sales channel
 * (Shopify's storefront 404s it) stays hidden here too, when the shop sells on the Online Store.
 */
export function productStatus(p: Pick<GProduct, 'status' | 'publishedAt'>, onlineStore: boolean) {
  if (p.status === 'ARCHIVED') return 'archived' as const
  if (p.status !== 'ACTIVE') return 'draft' as const
  return onlineStore && p.publishedAt === null ? ('draft' as const) : ('active' as const)
}

export function mapProduct(p: GProduct, variants: GVariant[], onlineStore = false): NProduct {
  const optionNames = [...p.options]
    .sort((a, b) => a.position - b.position)
    .map((o) => o.name)
    .filter((n, _, all) => !(all.length === 1 && n === 'Title'))
    .slice(0, 3)
  const productHsn = hsnDigits(p.hsn?.value)
  const images = p.media.nodes.flatMap((m, i) =>
    'image' in m && m.image
      ? [{ src: m.image.url, alt: m.alt || m.image.altText || null, position: i + 1 }]
      : [],
  )
  const giftCard = giftCardFrom({
    flag: p.isGiftCard,
    productType: p.productType,
    templateSuffix: p.templateSuffix,
  })
  const read = variants.map((v) => mapVariant(v, optionNames, productHsn))
  const mapped = giftCard ? asGiftCardVariants(read) : read
  for (const v of mapped) {
    if (v.imageSrc && !images.some((i) => i.src === v.imageSrc)) {
      images.push({ src: v.imageSrc, alt: null, position: images.length + 1 })
    }
  }
  return {
    sourceId: p.id,
    handle: p.handle,
    title: p.title,
    bodyHtml: p.descriptionHtml || null,
    vendor: p.vendor || null,
    productType: p.productType || null,
    tags: p.tags,
    status: productStatus(p, onlineStore),
    seoTitle: p.seo?.title || null,
    seoDescription: p.seo?.description || null,
    optionNames: optionNames.length ? optionNames : [],
    variants: optionNames.length
      ? mapped
      : mapped.slice(0, 1).map((v) => ({ ...v, optionValues: [] })),
    images,
    templateSuffix: templateSuffix(p.templateSuffix),
    isGiftCard: giftCard ?? false,
  }
}

/**
 * Bulk-op shape: the same fields as `PRODUCTS_QUERY`, but as one query over
 * every product (no `first`/pagination) so it runs outside the calculated
 * cost bucket. See the header of `bulk.ts` for the shapes and limits, cited
 * from shopify.dev.
 */
export const PRODUCTS_BULK_QUERY = `{
  products {
    edges {
      node {
        id handle title descriptionHtml vendor productType tags status templateSuffix publishedAt isGiftCard
        seo { title description }
        options { name position }
        hsn: metafield(namespace: "custom", key: "hsn") { value }
        media {
          edges { node { id ... on MediaImage { alt image { url altText } } } }
        }
        variants {
          edges { node { ${VARIANT_FIELDS} } }
        }
      }
    }
  }
}`

async function* fetchProductsBulk(
  client: ShopifyClient,
  onlineStore: boolean,
): AsyncGenerator<NProduct[]> {
  const url = await runBulkQuery(client, PRODUCTS_BULK_QUERY)
  if (!url) return
  for await (const nodes of streamBulkRoots<GProduct>(
    streamJsonl(url, client.fetchImpl),
    (type) =>
      type === 'ProductVariant'
        ? { field: 'variants', asPage: true }
        : type === 'MediaImage'
          ? { field: 'media', asPage: false }
          : null,
    [
      { field: 'variants', asPage: true },
      { field: 'media', asPage: false },
    ],
    BULK_BATCH_SIZE,
  )) {
    yield nodes.map((p) => mapProduct(p, p.variants.nodes.slice(0, 100), onlineStore))
  }
}

async function* fetchProductsPaged(
  client: ShopifyClient,
  onlineStore: boolean,
  search: string | null = null,
): AsyncGenerator<NProduct[]> {
  for await (const nodes of client.paginate<GProduct>(
    PRODUCTS_QUERY,
    (d) => (d as { products: Page<GProduct> }).products,
    { query: search },
    1500,
  )) {
    const batch: NProduct[] = []
    for (const p of nodes) {
      const variants = [...p.variants.nodes]
      if (p.variants.pageInfo.hasNextPage) {
        for await (const more of client.paginate<GVariant>(
          PRODUCT_VARIANTS_QUERY,
          (d) => (d as { product: { variants: Page<GVariant> } }).product.variants,
          { id: p.id },
          200,
          p.variants.pageInfo.endCursor,
        )) {
          for (const v of more) if (!variants.some((x) => x.id === v.id)) variants.push(v)
        }
      }
      batch.push(mapProduct(p, variants.slice(0, 100), onlineStore))
    }
    yield batch
  }
}

export const BULK_BATCH_SIZE = 50

/**
 * Products, preferring one Bulk Operation over the whole catalogue (no
 * per-page cost) and falling back to the paged path when a bulk op is
 * already running for this app/shop, Shopify rejects it, or it fails.
 */
export async function* fetchProducts(
  client: ShopifyClient,
  onBulkFallback?: (reason: unknown) => void,
  /** Only what matches (`updated_at:>'…'`): read page by page, no bulk operation. */
  search: string | null = null,
): AsyncGenerator<NProduct[]> {
  const onlineStore = await sellsOnOnlineStore(client)
  if (search) {
    yield* fetchProductsPaged(client, onlineStore, search)
    return
  }
  yield* bulkOrPaged(
    () => fetchProductsBulk(client, onlineStore),
    () => fetchProductsPaged(client, onlineStore),
    onBulkFallback,
  )
}

const ONLINE_STORE_QUERY = `query OnlineStoreProducts {
  products(first: 1, query: "published_status:published") { nodes { id } }
}`

/**
 * Whether the shop sells on the Online Store: some product is published there. A headless
 * shop publishes none, so its products are not hidden for missing that channel. Unknown
 * (the question failed) counts as no.
 */
async function sellsOnOnlineStore(client: ShopifyClient): Promise<boolean> {
  try {
    const data = await client.query<{ products?: { nodes: unknown[] } | null }>(
      ONLINE_STORE_QUERY,
      {},
      5,
    )
    return (data?.products?.nodes.length ?? 0) > 0
  } catch {
    return false
  }
}
/* -------------------------------------------------------------- pre-orders */

const SELLING_PLAN_GROUPS_QUERY = `query SellingPlanGroups($cursor: String) {
  sellingPlanGroups(first: 25, after: $cursor) {
    ${PAGE_INFO}
    nodes { name merchantCode products(first: 250) { nodes { id } } }
  }
}`

type GSellingPlanGroup = {
  name: string
  merchantCode: string
  products: { nodes: { id: string }[] }
}

const PREORDER_PLAN = /pre[-s]?order/i

/**
 * Shopify ids of the products sold through a pre-order purchase option: a selling plan group
 * named (or coded) like "Pre-order", as Shopify's pre-order apps make them. Needs
 * `read_purchase_options`; Shopify refuses the query without it (a `scope` error).
 */
export async function fetchPreorderProductIds(client: ShopifyClient): Promise<Set<string>> {
  const ids = new Set<string>()
  for await (const groups of client.paginate<GSellingPlanGroup>(
    SELLING_PLAN_GROUPS_QUERY,
    (d) =>
      (d as { sellingPlanGroups?: Page<GSellingPlanGroup> }).sellingPlanGroups ?? {
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    {},
    150,
  )) {
    for (const g of groups) {
      if (!PREORDER_PLAN.test(g.name) && !PREORDER_PLAN.test(g.merchantCode)) continue
      for (const p of g.products.nodes) ids.add(p.id)
    }
  }
  return ids
}
