import { describe, expect, it } from 'vitest'
import {
  canonicalPath,
  collectionGraph,
  jsonLd,
  metaDescription,
  productGraph,
  storeGraph,
  verificationMeta,
} from './seo'
import { emptySitemapXml, llmsTxt, robotsTxt, type StoreIndex, sitemapXml } from './seo-files'

const origin = 'https://waimers.in'

/** Parse a graph back out of its script body, as a crawler would. */
const parsed = (data: unknown) => JSON.parse(jsonLd(data).__html)

const product = {
  handle: 'veil',
  title: 'Veil Glasspad',
  description: 'Fast glass.',
  vendor: 'AbyssGaming',
  images: [{ url: 'https://cdn/x.jpg' }],
  variants: [
    { id: 'v1', title: 'Black', sku: 'VEIL-B', pricePaise: 749900, available: 3 },
    { id: 'v2', title: 'White', sku: null, pricePaise: 799900, available: 0 },
  ],
}

const index: StoreIndex = {
  products: [
    { path: '/products/veil', title: 'Veil [Pro]', fromPaise: 749900, updatedAt: new Date(0) },
  ],
  collections: [{ path: '/collections/glass', title: 'Glass & more' }],
  pages: [{ path: '/pages/about', title: 'About' }],
  blog: [{ path: '/blogs/news/launch' }],
}

describe('JSON-LD', () => {
  it('cannot close its own script tag', () => {
    const body = jsonLd({ name: '</script><script>alert(1)</script>' }).__html
    expect(body).not.toContain('<')
    expect(JSON.parse(body).name).toBe('</script><script>alert(1)</script>')
  })

  it('describes the store as Organization and WebSite with a search action', () => {
    const graph = parsed(storeGraph({ name: 'Waimers', origin, email: 'hi@waimers.in' }))['@graph']
    expect(graph.map((n: { '@type': string }) => n['@type'])).toEqual(['Organization', 'WebSite'])
    expect(graph[0].contactPoint.email).toBe('hi@waimers.in')
    expect(graph[1].potentialAction.target.urlTemplate).toBe(
      'https://waimers.in/search?q={search_term_string}',
    )
    expect(graph[1].publisher['@id']).toBe(graph[0]['@id'])
  })

  it('gives a product one offer per variant with INR prices and stock', () => {
    const [p, crumbs] = parsed(productGraph(product, origin, 'INR', 'Waimers'))['@graph']
    expect(p['@type']).toBe('Product')
    expect(p.brand.name).toBe('AbyssGaming')
    expect(p.offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '7499.00',
      highPrice: '7999.00',
      priceCurrency: 'INR',
      offerCount: 2,
    })
    expect(p.offers.offers.map((o: { availability: string }) => o.availability)).toEqual([
      'https://schema.org/InStock',
      'https://schema.org/OutOfStock',
    ])
    expect(crumbs['@type']).toBe('BreadcrumbList')
    expect(crumbs.itemListElement.at(-1).item).toBe('https://waimers.in/products/veil')
  })

  it('uses a single Offer, and the store as brand, for a one-variant product', () => {
    const one = { ...product, vendor: null, variants: [product.variants[0] as never] }
    const [p] = parsed(productGraph(one, origin, 'INR', 'Waimers'))['@graph']
    expect(p.offers['@type']).toBe('Offer')
    expect(p.sku).toBe('VEIL-B')
    expect(p.brand.name).toBe('Waimers')
  })

  it('lists a collection page with absolute URLs and running positions', () => {
    const graph = parsed(
      collectionGraph(
        { handle: 'glass', title: 'Glass', description: undefined },
        [{ handle: 'veil', title: 'Veil' }],
        25,
        30,
        origin,
      ),
    )['@graph']
    expect(graph[0]['@type']).toBe('CollectionPage')
    expect(graph[0].mainEntity.itemListElement[0]).toMatchObject({
      position: 25,
      url: 'https://waimers.in/products/veil',
    })
    expect(graph[1].itemListElement).toHaveLength(3)
  })
})

describe('metadata helpers', () => {
  it('cuts long descriptions on a word and flattens whitespace', () => {
    expect(metaDescription('  a\n b  ')).toBe('a b')
    expect(metaDescription('')).toBeUndefined()
    const long = metaDescription('word '.repeat(80)) ?? ''
    expect(long.length).toBeLessThanOrEqual(160)
    expect(long.endsWith('word…')).toBe(true)
  })

  it('canonicalises page 1 to the bare path', () => {
    expect(canonicalPath('/collections/glass')).toBe('/collections/glass')
    expect(canonicalPath('/collections/glass', 2)).toBe('/collections/glass?page=2')
  })
})

describe('crawler files', () => {
  it('robots.txt keeps private paths out and points at the sitemap', () => {
    const txt = robotsTxt(origin, { search: true, ai: true })
    expect(txt).toContain('Disallow: /checkout')
    expect(txt).toContain('Disallow: /account')
    expect(txt).toContain('Sitemap: https://waimers.in/sitemap.xml')
    expect(txt).not.toContain('GPTBot')
    expect(robotsTxt(origin, { search: false, ai: false })).toBe('User-agent: *\nDisallow: /\n')
  })

  it('robots.txt turns AI crawlers away in their own group when they are off', () => {
    const txt = robotsTxt(origin, { search: true, ai: false })
    expect(txt.startsWith('User-agent: GPTBot\n')).toBe(true)
    expect(txt).toContain('User-agent: ClaudeBot\n')
    expect(txt).toContain('User-agent: Google-Extended\n')
    // The AI group shuts everything; the general group still welcomes search engines.
    expect(txt).toContain('User-agent: Amazonbot\nDisallow: /\n\nUser-agent: *\nAllow: /\n')
    expect(txt).toContain('Sitemap: https://waimers.in/sitemap.xml')
  })

  it('sitemap.xml lists every indexable URL, escaped, with lastmod when known', () => {
    const xml = sitemapXml(origin, index)
    expect(xml).toContain('<loc>https://waimers.in/</loc>')
    expect(xml).toContain(
      '<loc>https://waimers.in/products/veil</loc><lastmod>1970-01-01T00:00:00.000Z</lastmod>',
    )
    expect(xml.match(/<url>/g)).toHaveLength(6)
    expect(emptySitemapXml()).not.toContain('<url>')
  })

  it('llms.txt is a Markdown map with safe link text', () => {
    const md = llmsTxt(origin, { name: 'Waimers', description: 'Glass\npads.' }, index)
    expect(md.startsWith('# Waimers\n\n> Glass pads.')).toBe(true)
    expect(md).toContain('- [Veil Pro](https://waimers.in/products/veil): from ₹7,499')
    expect(md).toContain('## Collections')
    expect(md).toContain('- [sitemap.xml](https://waimers.in/sitemap.xml)')
  })
})

describe('site verification tags', () => {
  const blank = { google: '', bing: '', meta: '', pinterest: '' }

  it('adds nothing when no token is saved', () => {
    expect(verificationMeta(blank)).toBeUndefined()
  })

  it('names each console its own meta tag', () => {
    expect(
      verificationMeta({
        google: 'g-token',
        bing: 'b-token',
        meta: 'm-token',
        pinterest: 'p-token',
      }),
    ).toEqual({
      google: 'g-token',
      other: {
        'msvalidate.01': 'b-token',
        'facebook-domain-verification': 'm-token',
        'p:domain_verify': 'p-token',
      },
    })
    expect(verificationMeta({ ...blank, meta: 'm-token' })).toEqual({
      other: { 'facebook-domain-verification': 'm-token' },
    })
  })
})
