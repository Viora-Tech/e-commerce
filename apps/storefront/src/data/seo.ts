/** Copy and limits for storefront SEO: structured data labels, robots.txt and llms.txt. */
export const seoContent = {
  home: 'Home',
  collections: 'Collections',
  customerService: 'customer service',
  llms: {
    collections: 'Collections',
    products: 'Products',
    pages: 'Pages',
    blog: 'Blog',
    more: (count: number) => `And ${count} more products: see the sitemap.`,
    sitemap: 'Sitemap',
    price: (amount: string) => `from ${amount}`,
  },
} as const

/** Search engines show about this much of a description. */
export const SEO_DESCRIPTION_MAX = 160

/** Paths that are private to a shopper and never belong in an index. */
export const ROBOTS_DISALLOW = [
  '/cart',
  '/checkout',
  '/account',
  '/search',
  '/documents',
  '/*?*sort=',
] as const

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

/** Files served even while the storefront password is on (they answer "locked" themselves). */
export const SEO_FILES = ['/robots.txt', '/sitemap.xml', '/llms.txt'] as const
