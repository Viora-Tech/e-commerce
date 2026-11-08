/**
 * Server entrypoint. Runs inside Instatic's QuickJS sandbox: no fs, no env, no
 * network unless `network.outbound` + `networkAllowedHosts` are granted.
 *
 * The evaluation reads a bundled fixture shaped like our storefront product data
 * (fixtures/products.json, built from the live Waimers product JSON-LD; stock and
 * compare-at prices edited so every card state shows). In production `fetchProducts`
 * would call the Koomerce storefront API with `network.outbound` and
 * `networkAllowedHosts: ['<store host>']`.
 *
 * Note: Instatic's SSRF guard blocks loopback and private IPs and the manifest
 * rejects `localhost`, so a plugin can never reach a Koomerce dev API on this
 * machine. That is why the fixture is bundled.
 */
import products from '../fixtures/products.json'

type Product = (typeof products)[number]

const FIELDS = [
  { id: 'title', label: 'Title', format: 'plain' as const },
  { id: 'url', label: 'Product URL', format: 'url' as const },
  { id: 'image', label: 'Image (640 w)', format: 'url' as const },
  { id: 'imageLarge', label: 'Image (1280 w)', format: 'url' as const },
  { id: 'priceText', label: 'Price', format: 'plain' as const },
  { id: 'compareAtText', label: 'Compare-at price', format: 'plain' as const },
  { id: 'saveText', label: 'Saving badge', format: 'plain' as const },
  { id: 'stockText', label: 'Stock line', format: 'plain' as const },
  { id: 'variantId', label: 'Variant id (for add to cart)', format: 'plain' as const },
  { id: 'availability', label: 'in-stock | sold-out', format: 'plain' as const },
]

// Format Indian digit grouping by hand rather than rely on Intl inside the QuickJS sandbox.
function inr(n: number): string {
  const s = String(Math.round(n))
  if (s.length <= 3) return `₹${s}`
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  return `₹${rest},${last3}`
}

function toItem(p: Product, live: boolean) {
  const compare = p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : null
  return {
    id: p.id,
    fields: {
      title: p.title,
      url: p.url,
      image: p.image,
      imageLarge: p.imageLarge,
      priceText: inr(p.price),
      compareAtText: compare ? inr(compare) : '',
      saveText: compare ? `Save ${Math.round((1 - p.price / compare) * 100)}%` : '',
      stockText: p.stock > 5 ? 'In stock' : p.stock > 0 ? `Only ${p.stock} left` : 'Sold out',
      variantId: p.variantId,
      availability: p.stock > 0 ? 'in-stock' : 'sold-out',
      ...(live ? { checkedAt: new Date().toISOString() } : {}),
    },
  }
}

/** The serializable subset Instatic sends to a plugin loop fetch (server/plugins/host/handlers/loops.ts). */
type LoopFetchCtx = {
  filters?: { availability?: string }
  orderBy?: string
  limit?: number
  offset?: number
  request?: { query: Record<string, string>; path: string }
}

/** The slice of the Instatic plugin api this entrypoint uses. */
type PluginApi = {
  plugin: { log: (message: string) => void }
  cms: { loops: { registerSource: (source: Record<string, unknown>) => Promise<void> } }
}

async function fetchProducts(ctx: LoopFetchCtx | undefined, live: boolean) {
  let list = products.slice()
  const f = ctx?.filters ?? {}
  if (f.availability === 'in-stock') list = list.filter((p) => p.stock > 0)
  const order = String(ctx?.orderBy ?? 'manual')
  if (order === 'price:asc') list.sort((a, b) => a.price - b.price)
  if (order === 'price:desc') list.sort((a, b) => b.price - a.price)
  const total = list.length
  const offset = Number(ctx?.offset ?? 0) || 0
  const limit = Number(ctx?.limit ?? 12) || 12
  return {
    items: list.slice(offset, offset + limit).map((p) => toItem(p, live)),
    totalItems: total,
  }
}

const common = {
  fields: FIELDS,
  filterSchema: {
    availability: {
      type: 'select',
      label: 'Availability',
      options: [
        { value: 'any', label: 'All products' },
        { value: 'in-stock', label: 'In stock only' },
      ],
    },
  },
  orderByOptions: [
    { id: 'manual', label: 'Collection order' },
    { id: 'price:asc', label: 'Price, low to high' },
    { id: 'price:desc', label: 'Price, high to low' },
  ],
  preview: () => products.slice(0, 4).map((p) => toItem(p, false)),
}

export async function activate(api: PluginApi) {
  await api.cms.loops.registerSource({
    id: 'koomerce.shop.products',
    label: 'Koomerce products',
    description: 'Products from the Koomerce catalogue, baked into the page at publish.',
    ...common,
    fetch: (ctx: LoopFetchCtx) => fetchProducts(ctx, false),
  })
  await api.cms.loops.registerSource({
    id: 'koomerce.shop.products-live',
    label: 'Koomerce products (live stock)',
    description: 'Same products, rendered at request time as a dynamic hole.',
    requestDependent: true,
    ...common,
    fetch: (ctx: LoopFetchCtx) => fetchProducts(ctx, true),
  })
  api.plugin.log('koomerce.shop loop sources registered')
}
