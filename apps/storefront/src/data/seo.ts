/** Copy and limits for storefront SEO: structured data labels, robots.txt and llms.txt. */
export const seoContent = {
  home: 'Home',
  collections: 'Collections',
  customerService: 'customer service',
  /**
   * Meta descriptions written for the merchant when a collection or product has none of its
   * own (`lib/seo.ts`). Generic on purpose: no country or delivery promise the store may not make.
   */
  autoDescription: {
    collection: (title: string, store: string, products: readonly string[]) =>
      products.length
        ? `Shop ${title} at ${store}: ${products.join(', ')} and more.`
        : `Shop ${title} at ${store}.`,
    product: (title: string, store: string, vendor: string | null, price: string | null) =>
      `Buy ${title}${vendor ? ` by ${vendor}` : ''} at ${store}${price ? `, from ${price}` : ''}.`,
  },
  llms: {
    collections: 'Collections',
    products: 'Products',
    pages: 'Pages',
    blog: 'Blog',
    more: (count: number) => `And ${count} more products: see the sitemap.`,
    sitemap: 'Sitemap',
    price: (amount: string) => `from ${amount}`,
    about: 'About the store',
    agents: 'For AI agents',
    agentsLine: (url: string) =>
      `- Search products, prices, stock and store policies live over MCP (read-only, no sign-in): ${url}`,
    markdownLine: (origin: string) =>
      `- Every product page has a Markdown copy: add .md to its URL (${origin}/products/<handle>.md)`,
  },
  /** `/products/<handle>.md`: one product as Markdown for AI agents (`lib/shopify-json/markdown.ts`). */
  markdown: {
    brand: 'Brand',
    type: 'Type',
    price: 'Price',
    priceRange: (low: string, high: string) => `${low} to ${high}`,
    mrp: 'MRP',
    availability: 'Availability',
    inStock: 'In stock',
    preorder: 'Pre-order',
    soldOut: 'Sold out',
    options: 'Options',
    variants: 'Variants',
    variant: 'Variant',
    sku: 'SKU',
    description: 'Description',
    policies: 'Store policies',
    shipping: 'Shipping policy',
    refund: 'Refund policy',
    buy: 'Add to cart link',
  },
} as const

/** Search engines show about this much of a description. */
export const SEO_DESCRIPTION_MAX = 160

/**
 * Paths that are private to a shopper and never belong in an index. Sorted and filtered
 * collection views are not here: they carry `noindex, follow`, which Google can only read
 * on a page it may crawl.
 */
export const ROBOTS_DISALLOW = [
  '/cart',
  '/checkout',
  '/account',
  '/search',
  '/documents',
  // Endpoints and one-use token links, not pages (Search Console listed them as 404s). Trailing
  // slash so a real page that merely starts with the word (`/cod-guide`) stays crawlable.
  '/theme-actions/',
  '/newsletter/confirm/',
  '/unsubscribe/',
  '/cod/',
] as const

/** How many product names a collection's written-for-you description lists. */
export const AUTO_DESCRIPTION_PRODUCTS = 3

/**
 * AI crawlers turned away when Preferences › AI crawlers is off: model training and
 * AI answer engines. Regular search crawlers (Googlebot, Bingbot) are not on it.
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'CCBot',
  'Bytespider',
  'meta-externalagent',
  'Amazonbot',
] as const

/** llms.txt lists at most this many products; the sitemap has the rest. */
export const LLMS_PRODUCT_LIMIT = 200

/**
 * Shopify's child sitemaps, which Search Console and old links still ask for after a move from
 * Shopify: each serves that part of our sitemap (`sitemap.xml/[part]`).
 */
export const SHOPIFY_SITEMAPS = {
  '/sitemap_products_1.xml': 'products',
  '/sitemap_collections_1.xml': 'collections',
  '/sitemap_pages_1.xml': 'pages',
  '/sitemap_blogs_1.xml': 'blogs',
} as const

export type SitemapPart = (typeof SHOPIFY_SITEMAPS)[keyof typeof SHOPIFY_SITEMAPS]

/** Files served even while the storefront password is on (they answer "locked" themselves). */
export const SEO_FILES = [
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  ...Object.keys(SHOPIFY_SITEMAPS),
] as const
