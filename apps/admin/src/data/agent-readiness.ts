import type { AgentCheckId } from '@commerce/core/agent-readiness'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Settings → Store health › AI shopping agents: each check passes or fails with one fix line. */
export const agentReadinessContent = {
  title: 'AI shopping agents',
  intro:
    'Whether ChatGPT, Claude, Perplexity and other AI assistants can find your products, prices and stock. We check your live site.',
  run: 'Check now',
  running: 'Checking your live site…',
  checked: (when: string) => `Checked ${when}`,
  passed: (n: number, total: number) => `${n} of ${total} pass`,
  noDomain: 'Connect your own domain first. We check the live site shoppers visit.',
  failed: 'Could not check your site. Try again in a moment.',
  pass: 'Pass',
  fail: 'Fix',
  open: 'Open',
  checks: {
    bots_allowed: {
      title: 'AI assistants can open your pages',
      fix: (names: string) =>
        `${names || 'AI bots'} get blocked. In Cloudflare, turn off “Block AI bots” for AI search and assistants (AI Crawl Control).`,
    },
    robots_allows_ai: {
      title: 'robots.txt lets AI assistants in',
      fix: (names: string) =>
        `robots.txt shuts out ${names || 'AI assistants'}. Turn on “Let AI crawlers read my store” in Preferences, and turn off Cloudflare’s managed robots.txt.`,
    },
    llms_txt: {
      title: 'llms.txt guides assistants to your catalogue',
      fix: () =>
        'It shows once AI crawlers are allowed in Preferences and the password page is off.',
    },
    sitemap_products: {
      title: 'Sitemap lists your products',
      fix: () =>
        'No product links in your sitemap. Publish products and allow search engines in Preferences.',
    },
    product_data: {
      title: 'Product pages carry name, price and stock in their code',
      fix: () =>
        'Your product page has no product structured data. Use the store’s product template, or ask us.',
    },
    product_variants: {
      title: 'Each variant has its own price and stock in the code',
      fix: () =>
        'Variants are described as one product. Use the store’s product template, or ask us.',
    },
    price_tags: {
      title: 'Price tags for link previews',
      fix: () =>
        'Product pages have no price meta tags. Use the store’s product template, or ask us.',
    },
    markdown_copy: {
      title: 'A plain-text (Markdown) copy of each product',
      fix: () => 'Not on your live site yet. It comes with the next Koomerce update.',
    },
    product_feed: {
      title: 'Product feed (/products.json)',
      fix: () => 'Not on your live site yet. It comes with the next Koomerce update.',
    },
    mcp_endpoint: {
      title: 'Assistants can search your store live (MCP)',
      fix: () =>
        'Your store’s MCP did not answer. It is off while the password page is on or AI crawlers are off in Preferences.',
    },
    products_have_sku: {
      title: 'Every product has a SKU or barcode',
      fix: (n: number) =>
        `${plural(n, 'active product has', 'active products have')} a variant without a SKU or barcode. Add them so assistants and Google match the exact item.`,
    },
  } satisfies Record<AgentCheckId, { title: string; fix: (...args: never[]) => string }>,
}
