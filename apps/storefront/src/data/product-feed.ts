/**
 * Limits and copy for the public product feed (`lib/product-feed`): `/feeds/products.xml` and
 * `/feeds/products.csv`, on when the merchant switches on Preferences › Product feeds. Machine
 * readers only, so English.
 */

/** The feed files' paths (the proxy never mints a visitor cookie on these public, cacheable files). */
export const FEED_FILES = ['/feeds/products.xml', '/feeds/products.csv'] as const

export const PRODUCT_FEED = {
  currency: 'INR',
  /** Products read per query while the feed is built. */
  pageSize: 250,
  /** The most products one feed lists; past it a feed tool needs the full catalogue APIs. */
  maxProducts: 5000,
  /** The most rows (variants) one feed writes. */
  maxRows: 20_000,
  /** One IP's feed requests per minute: a feed tool reads the file a few times a day. */
  ipRule: { limit: 20, windowMs: 60_000 },
  /** Browsers and feed tools ask again after 15 minutes; a CDN serves stale for an hour while it refetches. */
  cacheControl: 'public, max-age=900, s-maxage=900, stale-while-revalidate=3600',
  /** The RSS channel's description, after the store's name. */
  description: 'Products from',
  tooMany: 'Too many requests. Please slow down.',
  notFound: 'Not found',
} as const
