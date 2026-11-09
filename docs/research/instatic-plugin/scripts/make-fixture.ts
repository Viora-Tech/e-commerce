// Builds the raw product list from public Waimers product pages (their Product JSON-LD).
// Usage: bun make-fixture.ts <handle> [<handle> …] > raw-products.json
// The eval then resized image URLs to the CDN's -w640/-w1280 WebP copies and set stock and
// compare-at prices by hand so every card state shows (shop/fixtures/products.json).
type Offer = {
  price?: string | number
  lowPrice?: string | number
  priceCurrency?: string
  sku?: string
  '@id'?: string
  availability?: string
}
type ProductLd = {
  '@type'?: string
  name?: string
  image?: string | { url?: string } | Array<string | { url?: string }>
  offers?: Offer | Offer[] | { offers?: Offer[] }
}

function offersOf(p: ProductLd): Offer[] {
  const o = p.offers
  if (!o) return []
  if (Array.isArray(o)) return o
  if ('offers' in o && Array.isArray(o.offers)) return o.offers
  return [o as Offer]
}

function findProduct(json: unknown): ProductLd | null {
  const list: unknown[] = Array.isArray(json)
    ? json
    : ((json as { '@graph'?: unknown[] })['@graph'] ?? [json])
  return (list.find((x) => (x as ProductLd)['@type'] === 'Product') as ProductLd) ?? null
}

const handles = process.argv.slice(2)
const out: unknown[] = []
for (const h of handles) {
  const html = await (await fetch(`https://www.waimers.in/products/${h}`)).text()
  const blocks = [
    ...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g),
  ].map((m) => m[1])
  let p: ProductLd | null = null
  for (const b of blocks) {
    try {
      p = findProduct(JSON.parse(b)) ?? p
    } catch {
      // Not JSON: skip this block.
    }
  }
  if (!p) {
    console.error('no product ld', h)
    continue
  }
  const offers = offersOf(p)
  const first = offers[0] ?? {}
  const prices = offers.map((x) => Number(x.price ?? x.lowPrice)).filter((n) => n > 0)
  const img = Array.isArray(p.image) ? p.image[0] : p.image
  out.push({
    id: h,
    handle: h,
    title: p.name,
    url: `/products/${h}`,
    price: Math.min(...prices),
    currency: first.priceCurrency ?? 'INR',
    compareAtPrice: null,
    image: typeof img === 'string' ? img : (img?.url ?? null),
    available: offers.some((x) => String(x.availability ?? '').includes('InStock')),
    variantId: String(first.sku ?? first['@id'] ?? h),
  })
}
console.log(JSON.stringify(out, null, 2))
