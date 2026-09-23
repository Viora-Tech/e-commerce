/**
 * Admin GraphQL queries and their mapping onto the importer's normalised
 * shapes. Page sizes keep each query under Shopify's 1,000-point cost ceiling;
 * nested connections that can run longer (variants, collection products) are
 * paged separately.
 */
import type { CollectionCondition, CollectionOp, CollectionRules } from '@commerce/db'
import type { ShopifyClient } from './shopify-client'
import type {
  NAddress,
  NArticle,
  NCollection,
  NCustomer,
  NMenu,
  NMenuItem,
  NOrder,
  NPage,
  NProduct,
  NRedirect,
  NVariant,
} from './types'

type Money = { shopMoney: { amount: string } } | null | undefined
type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }

const money = (m: Money): number => Math.round(Number(m?.shopMoney.amount ?? 0) * 100)
const rupees = (v: string | null | undefined): number | null =>
  v === null || v === undefined || v === '' ? null : Math.round(Number(v) * 100)

const PAGE_INFO = 'pageInfo { hasNextPage endCursor }'

export const SHOP_QUERY = '{ shop { name myshopifyDomain } }'

/* ---------------------------------------------------------------- products */

const VARIANT_FIELDS = `id title sku barcode price compareAtPrice taxable inventoryQuantity
  selectedOptions { name value } image { url }
  inventoryItem { tracked harmonizedSystemCode unitCost { amount } measurement { weight { unit value } } }`

export const PRODUCTS_QUERY = `query Products($cursor: String) {
  products(first: 10, after: $cursor, sortKey: ID) {
    ${PAGE_INFO}
    nodes {
      id handle title descriptionHtml vendor productType tags status
      seo { title description }
      options { name position }
      hsn: metafield(namespace: "custom", key: "hsn") { value }
      media(first: 25) { nodes { ... on MediaImage { alt image { url altText } } } }
      variants(first: 50) { ${PAGE_INFO} nodes { ${VARIANT_FIELDS} } }
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
  }
}

export function mapProduct(p: GProduct, variants: GVariant[]): NProduct {
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
  const mapped = variants.map((v) => mapVariant(v, optionNames, productHsn))
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
    status: p.status === 'ACTIVE' ? 'active' : p.status === 'ARCHIVED' ? 'archived' : 'draft',
    seoTitle: p.seo?.title || null,
    seoDescription: p.seo?.description || null,
    optionNames: optionNames.length ? optionNames : [],
    variants: optionNames.length
      ? mapped
      : mapped.slice(0, 1).map((v) => ({ ...v, optionValues: [] })),
    images,
  }
}

export async function* fetchProducts(client: ShopifyClient): AsyncGenerator<NProduct[]> {
  for await (const nodes of client.paginate<GProduct>(
    PRODUCTS_QUERY,
    (d) => (d as { products: Page<GProduct> }).products,
    {},
    800,
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
      batch.push(mapProduct(p, variants.slice(0, 100)))
    }
    yield batch
  }
}

/* ------------------------------------------------------------- collections */

export const COLLECTIONS_QUERY = `query Collections($cursor: String) {
  collections(first: 5, after: $cursor, sortKey: ID) {
    ${PAGE_INFO}
    nodes {
      id handle title descriptionHtml sortOrder
      image { url altText }
      seo { title description }
      ruleSet { appliedDisjunctively rules { column relation condition } }
      products(first: 100) { ${PAGE_INFO} nodes { handle } }
    }
  }
}`

export const COLLECTION_PRODUCTS_QUERY = `query CollectionProducts($id: ID!, $cursor: String) {
  collection(id: $id) { products(first: 250, after: $cursor) { ${PAGE_INFO} nodes { handle } } }
}`

type GCollection = {
  id: string
  handle: string
  title: string
  descriptionHtml: string | null
  sortOrder: string | null
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
export function mapRules(ruleSet: GCollection['ruleSet']): {
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

export async function* fetchCollections(client: ShopifyClient): AsyncGenerator<NCollection[]> {
  for await (const nodes of client.paginate<GCollection>(
    COLLECTIONS_QUERY,
    (d) => (d as { collections: Page<GCollection> }).collections,
    {},
    600,
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
      })
    }
    yield batch
  }
}

/* --------------------------------------------------------------- customers */

export const CUSTOMERS_QUERY = `query Customers($cursor: String) {
  customers(first: 100, after: $cursor, sortKey: ID) {
    ${PAGE_INFO}
    nodes {
      id email phone firstName lastName tags note createdAt
      emailMarketingConsent { marketingState }
      smsMarketingConsent { marketingState }
      defaultAddress { firstName lastName company address1 address2 city province provinceCode country countryCodeV2 zip phone }
    }
  }
}`

type GAddress = {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  company: string | null
  address1: string | null
  address2: string | null
  city: string | null
  province: string | null
  provinceCode: string | null
  country?: string | null
  countryCodeV2: string | null
  zip: string | null
  phone: string | null
}

type GCustomer = {
  id: string
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  tags: string[]
  note: string | null
  createdAt: string | null
  emailMarketingConsent: { marketingState: string } | null
  smsMarketingConsent: { marketingState: string } | null
  defaultAddress: GAddress | null
}

export function mapAddress(a: GAddress | null): NAddress | null {
  if (!a?.address1) return null
  return {
    name: a.name ?? [a.firstName, a.lastName].filter(Boolean).join(' '),
    company: a.company || null,
    line1: a.address1,
    line2: a.address2 || null,
    city: a.city ?? '',
    province: a.province || null,
    provinceCode: a.provinceCode || null,
    country: a.country ?? null,
    countryCode: a.countryCodeV2 || null,
    zip: a.zip ?? '',
    phone: a.phone || null,
  }
}

export function mapCustomer(c: GCustomer): NCustomer {
  return {
    sourceId: c.id,
    email: c.email?.toLowerCase() || null,
    phone: c.phone || null,
    firstName: c.firstName || null,
    lastName: c.lastName || null,
    acceptsMarketing: c.emailMarketingConsent?.marketingState === 'SUBSCRIBED',
    acceptsSmsMarketing: c.smsMarketingConsent?.marketingState === 'SUBSCRIBED',
    tags: c.tags,
    note: c.note || null,
    address: mapAddress(c.defaultAddress),
    createdAt: c.createdAt,
  }
}

export async function* fetchCustomers(client: ShopifyClient): AsyncGenerator<NCustomer[]> {
  for await (const nodes of client.paginate<GCustomer>(
    CUSTOMERS_QUERY,
    (d) => (d as { customers: Page<GCustomer> }).customers,
    {},
    300,
  )) {
    yield nodes.map(mapCustomer)
  }
}

/* ------------------------------------------------------------------ orders */

export const ORDERS_QUERY = `query Orders($cursor: String) {
  orders(first: 25, after: $cursor, sortKey: CREATED_AT) {
    ${PAGE_INFO}
    nodes {
      id name email phone createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus
      currencyCode tags note paymentGatewayNames discountCodes
      subtotalPriceSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalPriceSet { shopMoney { amount } }
      totalDiscountsSet { shopMoney { amount } }
      totalRefundedSet { shopMoney { amount } }
      customer { firstName lastName }
      shippingAddress { name company address1 address2 city province provinceCode countryCodeV2 zip phone }
      lineItems(first: 50) {
        nodes {
          title variantTitle sku quantity taxable unfulfilledQuantity
          originalUnitPriceSet { shopMoney { amount } }
          product { handle }
        }
      }
    }
  }
}`

type GOrder = {
  id: string
  name: string
  email: string | null
  phone: string | null
  createdAt: string
  cancelledAt: string | null
  displayFinancialStatus: string | null
  displayFulfillmentStatus: string | null
  currencyCode: string | null
  tags: string[]
  note: string | null
  paymentGatewayNames: string[]
  discountCodes: string[]
  subtotalPriceSet: Money
  totalShippingPriceSet: Money
  totalTaxSet: Money
  totalPriceSet: Money
  totalDiscountsSet: Money
  totalRefundedSet: Money
  customer: { firstName: string | null; lastName: string | null } | null
  shippingAddress: GAddress | null
  lineItems: {
    nodes: {
      title: string
      variantTitle: string | null
      sku: string | null
      quantity: number
      taxable: boolean
      unfulfilledQuantity: number
      originalUnitPriceSet: Money
      product: { handle: string } | null
    }[]
  }
}

export function mapOrder(o: GOrder): NOrder {
  const digits = o.name.match(/\d+/g)
  const number = digits ? Number(digits.join('')) : null
  return {
    sourceId: o.id,
    name: o.name,
    number: number && Number.isSafeInteger(number) && number < 2_000_000_000 ? number : null,
    email: o.email?.toLowerCase() || null,
    phone: o.phone || null,
    customerName: o.customer
      ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') || null
      : (o.shippingAddress?.name ?? null),
    financialStatus: o.displayFinancialStatus?.toLowerCase() ?? null,
    fulfillmentStatus: o.displayFulfillmentStatus?.toLowerCase() ?? null,
    currency: o.currencyCode,
    subtotalPaise: money(o.subtotalPriceSet),
    shippingPaise: money(o.totalShippingPriceSet),
    taxPaise: money(o.totalTaxSet),
    totalPaise: money(o.totalPriceSet),
    discountCode: o.discountCodes[0] ?? null,
    discountPaise: money(o.totalDiscountsSet),
    refundedPaise: money(o.totalRefundedSet),
    paymentMethod: o.paymentGatewayNames.join(', ') || null,
    paymentReference: null,
    createdAt: o.createdAt,
    cancelledAt: o.cancelledAt,
    tags: o.tags,
    note: o.note || null,
    shippingAddress: mapAddress(o.shippingAddress),
    lines: o.lineItems.nodes
      .filter((l) => l.quantity > 0)
      .map((l) => ({
        title: l.title,
        variantTitle: l.variantTitle && l.variantTitle !== 'Default Title' ? l.variantTitle : null,
        sku: l.sku || null,
        productHandle: l.product?.handle ?? null,
        quantity: l.quantity,
        unitPricePaise: money(l.originalUnitPriceSet),
        fulfilledQuantity: Math.max(0, l.quantity - l.unfulfilledQuantity),
        taxable: l.taxable,
      })),
  }
}

export async function* fetchOrders(client: ShopifyClient): AsyncGenerator<NOrder[]> {
  for await (const nodes of client.paginate<GOrder>(
    ORDERS_QUERY,
    (d) => (d as { orders: Page<GOrder> }).orders,
    {},
    600,
  )) {
    yield nodes.map(mapOrder)
  }
}

/* ---------------------------------------------------- pages and articles */

export const PAGES_QUERY = `query Pages($cursor: String) {
  pages(first: 50, after: $cursor) {
    ${PAGE_INFO}
    nodes {
      id handle title body isPublished publishedAt
      seoTitle: metafield(namespace: "global", key: "title_tag") { value }
      seoDescription: metafield(namespace: "global", key: "description_tag") { value }
    }
  }
}`

type GPage = {
  id: string
  handle: string
  title: string
  body: string | null
  isPublished: boolean
  publishedAt: string | null
  seoTitle: { value: string } | null
  seoDescription: { value: string } | null
}

export async function* fetchPages(client: ShopifyClient): AsyncGenerator<NPage[]> {
  for await (const nodes of client.paginate<GPage>(
    PAGES_QUERY,
    (d) => (d as { pages: Page<GPage> }).pages,
    {},
    150,
  )) {
    yield nodes.map((p) => ({
      sourceId: p.id,
      handle: p.handle,
      title: p.title,
      bodyHtml: p.body || null,
      seoTitle: p.seoTitle?.value || null,
      seoDescription: p.seoDescription?.value || null,
      published: p.isPublished,
      publishedAt: p.publishedAt,
    }))
  }
}

export const ARTICLES_QUERY = `query Articles($cursor: String) {
  articles(first: 50, after: $cursor) {
    ${PAGE_INFO}
    nodes {
      id handle title body summary tags isPublished publishedAt
      author { name }
      image { url altText }
      blog { handle title }
      seoTitle: metafield(namespace: "global", key: "title_tag") { value }
      seoDescription: metafield(namespace: "global", key: "description_tag") { value }
    }
  }
}`

type GArticle = {
  id: string
  handle: string
  title: string
  body: string | null
  summary: string | null
  tags: string[]
  isPublished: boolean
  publishedAt: string | null
  author: { name: string } | null
  image: { url: string; altText: string | null } | null
  blog: { handle: string; title: string }
  seoTitle: { value: string } | null
  seoDescription: { value: string } | null
}

export async function* fetchArticles(client: ShopifyClient): AsyncGenerator<NArticle[]> {
  for await (const nodes of client.paginate<GArticle>(
    ARTICLES_QUERY,
    (d) => (d as { articles: Page<GArticle> }).articles,
    {},
    200,
  )) {
    yield nodes.map((a) => ({
      sourceId: a.id,
      blogHandle: a.blog.handle,
      blogTitle: a.blog.title,
      handle: a.handle,
      title: a.title,
      author: a.author?.name ?? null,
      bodyHtml: a.body || null,
      summaryHtml: a.summary || null,
      tags: a.tags,
      image: a.image ? { src: a.image.url, alt: a.image.altText, position: 1 } : null,
      published: a.isPublished,
      publishedAt: a.publishedAt,
      seoTitle: a.seoTitle?.value || null,
      seoDescription: a.seoDescription?.value || null,
    }))
  }
}

/* ------------------------------------------------------ menus, redirects */

const ITEM = 'title type url'
export const MENUS_QUERY = `query Menus($cursor: String) {
  menus(first: 25, after: $cursor) {
    ${PAGE_INFO}
    nodes { id handle title items { ${ITEM} items { ${ITEM} items { ${ITEM} } } } }
  }
}`

type GMenuItem = { title: string; type: string; url: string | null; items?: GMenuItem[] }
type GMenu = { id: string; handle: string; title: string; items: GMenuItem[] }

const mapItem = (i: GMenuItem): NMenuItem => ({
  title: i.title,
  type: i.type,
  url: i.url,
  items: (i.items ?? []).map(mapItem),
})

export async function* fetchMenus(client: ShopifyClient): AsyncGenerator<NMenu[]> {
  for await (const nodes of client.paginate<GMenu>(
    MENUS_QUERY,
    (d) => (d as { menus: Page<GMenu> }).menus,
    {},
    100,
  )) {
    yield nodes.map((m) => ({
      sourceId: m.id,
      handle: m.handle,
      title: m.title,
      items: m.items.map(mapItem),
    }))
  }
}

export const REDIRECTS_QUERY = `query Redirects($cursor: String) {
  urlRedirects(first: 250, after: $cursor) { ${PAGE_INFO} nodes { id path target } }
}`

export async function* fetchRedirects(client: ShopifyClient): AsyncGenerator<NRedirect[]> {
  for await (const nodes of client.paginate<{ id: string; path: string; target: string }>(
    REDIRECTS_QUERY,
    (d) => (d as { urlRedirects: Page<{ id: string; path: string; target: string }> }).urlRedirects,
    {},
    260,
  )) {
    yield nodes.map((r) => ({ sourceId: r.id, path: r.path, target: r.target }))
  }
}
