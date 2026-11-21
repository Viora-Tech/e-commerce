/** Limits and copy for the Shopify-compatible public JSON (`lib/shopify-json`). */
export const SHOPIFY_JSON = {
  /** Shopify's default page size for `/products.json`. */
  defaultLimit: 30,
  /** Shopify's largest page. */
  maxLimit: 250,
  /** Past this page every store answers an empty list; it keeps the cache keys bounded. */
  maxPage: 100,
  /** Collections listed by `/collections.json`, as Shopify. */
  collectionsLimit: 250,
  currency: 'INR',
  /** One IP's requests per minute across these endpoints: a feed crawler reads a few pages. */
  ipRule: { limit: 120, windowMs: 60_000 },
  /** Browsers ask again after five minutes; a CDN keeps it ten and serves stale while it refetches. */
  cacheControl: 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
  tooMany: 'Too many requests. Please slow down.',
  notFound: 'Not Found',
} as const
