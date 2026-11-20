/** SOURCE OF TRUTH: AI agent readiness check tests — robots.txt matching, JSON-LD reading and each pass/fail rule */
import { describe, expect, it } from 'vitest'
import {
  AGENT_CHECK_IDS,
  type AgentProbe,
  agentReadiness,
  jsonLdNodes,
  robotsAllows,
} from './agent-readiness'

/** waimers.in's robots.txt on 20 Nov 2026. */
const ROBOTS = `User-agent: *
Allow: /
Disallow: /cart
Disallow: /checkout
Disallow: /search
Disallow: /*?*sort=

Sitemap: https://www.waimers.in/sitemap.xml
`

const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`

const GROUP_PAGE = [
  '<html><head>',
  '<meta property="product:price:amount" content="999.00"/>',
  '<link rel="alternate" type="text/markdown" href="/products/pad.md"/>',
  ld({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProductGroup',
        name: 'Pad',
        offers: { '@type': 'AggregateOffer', lowPrice: '999.00' },
        hasVariant: [{ '@type': 'Product', offers: { '@type': 'Offer', price: '999.00' } }],
      },
    ],
  }),
  '</head></html>',
].join('')

const good: AgentProbe = {
  origin: 'https://www.waimers.in',
  robots: { status: 200, body: ROBOTS },
  llms: { status: 200, body: '# Waimers' },
  sitemap: {
    status: 200,
    body: '<urlset><url><loc>https://www.waimers.in/products/pad</loc></url></urlset>',
  },
  product: { url: 'https://www.waimers.in/products/pad', status: 200, body: GROUP_PAGE },
  bots: [
    { name: 'ClaudeBot', status: 200 },
    { name: 'GPTBot', status: 200 },
  ],
  markdown: { status: 200, contentType: 'text/markdown; charset=utf-8', body: '# Pad' },
  feed: { status: 200, contentType: 'application/json; charset=utf-8' },
  mcpTools: ['search_catalog', 'get_product'],
}

const facts = { aiAllowed: true, productsNoSku: 0 }
const now = new Date('2026-11-20T12:00:00Z')
const check = (probe: AgentProbe, f = facts) => {
  const report = agentReadiness(probe, f, now)
  return (id: string) => report.checks.find((c) => c.id === id)
}

describe('robotsAllows', () => {
  it('reads waimers.in: products open to every agent, search and cart closed', () => {
    expect(robotsAllows(ROBOTS, 'ClaudeBot', '/products/pad')).toBe(true)
    expect(robotsAllows(ROBOTS, 'GPTBot', '/search')).toBe(false)
    expect(robotsAllows(ROBOTS, 'GPTBot', '/collections/all?sort=price')).toBe(false)
  })

  it("follows the agent's own group over *, and the longest rule", () => {
    const text = 'User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /'
    expect(robotsAllows(text, 'ClaudeBot', '/products/pad')).toBe(false)
    expect(robotsAllows(text, 'PerplexityBot', '/products/pad')).toBe(true)
    expect(robotsAllows('User-agent: *\nDisallow: /\nAllow: /products/', 'X', '/products/a')).toBe(
      true,
    )
  })
})

describe('jsonLdNodes', () => {
  it('flattens @graph and skips a broken block', () => {
    const html = `${ld({ '@graph': [{ '@type': 'Product' }, { '@type': 'BreadcrumbList' }] })}<script type="application/ld+json">{oops</script>`
    expect(jsonLdNodes(html).map((n) => n['@type'])).toEqual(['Product', 'BreadcrumbList'])
  })
})

describe('agentReadiness', () => {
  it('passes every check for a ready store, in a fixed order', () => {
    const report = agentReadiness(good, facts, now)
    expect(report.checks.map((c) => c.id)).toEqual([...AGENT_CHECK_IDS])
    expect(report.checks.filter((c) => !c.pass)).toEqual([])
    expect(report.passed).toBe(AGENT_CHECK_IDS.length)
  })

  it('names the bots a firewall blocks (Cloudflare "Block AI bots")', () => {
    const c = check({
      ...good,
      bots: [
        { name: 'ClaudeBot', status: 403 },
        { name: 'GPTBot', status: 200 },
      ],
    })
    expect(c('bots_allowed')).toMatchObject({ pass: false, names: ['ClaudeBot'] })
  })

  it('fails robots.txt when it shuts an agent out, or the store turned AI crawlers off', () => {
    const shut = {
      ...good,
      robots: { status: 200, body: `User-agent: ClaudeBot\nDisallow: /\n\n${ROBOTS}` },
    }
    expect(check(shut)('robots_allows_ai')?.names).toEqual(['ClaudeBot'])
    expect(check(good, { ...facts, aiAllowed: false })('robots_allows_ai')?.pass).toBe(false)
  })

  it('fails variants for a Product with an AggregateOffer, passes a one-offer Product', () => {
    const aggregate = ld({
      '@type': 'Product',
      offers: { '@type': 'AggregateOffer', lowPrice: '1' },
    })
    const one = ld({ '@type': 'Product', offers: { '@type': 'Offer', price: '1' } })
    const page = (body: string) => ({
      ...good,
      product: { url: `${good.origin}/products/pad`, status: 200, body },
    })
    expect(check(page(aggregate))('product_variants')?.pass).toBe(false)
    expect(check(page(aggregate))('product_data')?.pass).toBe(true)
    expect(check(page(one))('product_variants')?.pass).toBe(true)
    expect(check(page('<html></html>'))('product_data')?.pass).toBe(false)
    expect(check(page(one))('price_tags')?.pass).toBe(false)
    expect(check(page(one))('markdown_copy')?.pass).toBe(false)
  })

  it('fails what did not answer: llms.txt, sitemap without products, feed, MCP, SKUs', () => {
    const c = check(
      {
        ...good,
        llms: { status: 404 },
        sitemap: { status: 200, body: '<urlset></urlset>' },
        feed: { status: 404, contentType: 'text/html' },
        mcpTools: null,
      },
      { ...facts, productsNoSku: 12 },
    )
    expect(c('llms_txt')?.pass).toBe(false)
    expect(c('sitemap_products')).toMatchObject({ pass: false, count: 0 })
    expect(c('product_feed')?.pass).toBe(false)
    expect(c('mcp_endpoint')?.pass).toBe(false)
    expect(c('products_have_sku')).toMatchObject({ pass: false, count: 12 })
  })
})
