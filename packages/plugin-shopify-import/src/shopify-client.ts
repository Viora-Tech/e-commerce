/**
 * Minimal Shopify Admin GraphQL client for a custom-app access token: cursor
 * pagination and Shopify's calculated-cost rate limit (leaky bucket), plus
 * retries on 429 and 5xx. No SDK, so tests can hand it a fake `fetch`.
 */

export const SHOPIFY_API_VERSION = '2025-07'

export class ShopifyError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'scope' | 'not_found' | 'throttled' | 'server' | 'query',
  ) {
    super(message)
    this.name = 'ShopifyError'
  }
}

type Throttle = { maximumAvailable: number; currentlyAvailable: number; restoreRate: number }

type GraphQLResponse<T> = {
  data?: T
  errors?: { message: string; extensions?: { code?: string } }[]
  extensions?: { cost?: { requestedQueryCost?: number; throttleStatus?: Throttle } }
}

export type ClientOptions = {
  shopDomain: string
  accessToken: string
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  maxAttempts?: number
}

/** `waimers`, `waimers.myshopify.com` or a pasted admin URL → `waimers.myshopify.com`. */
export function normaliseShopDomain(input: string): string | null {
  let value = input.trim().toLowerCase()
  value = value.replace(/^https?:\/\//, '').split(/[/?#]/)[0] ?? ''
  const admin = /^admin\.shopify\.com$/.test(value)
    ? /\/store\/([a-z0-9-]+)/.exec(input.toLowerCase())?.[1]
    : null
  if (admin) value = admin
  if (!value.includes('.')) value = `${value}.myshopify.com`
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value) ? value : null
}

export class ShopifyClient {
  private readonly doFetch: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly maxAttempts: number
  /** Last bucket state Shopify reported; used to wait before an expensive query. */
  private bucket: Throttle | null = null

  constructor(private readonly opts: ClientOptions) {
    this.doFetch = opts.fetch ?? fetch
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.maxAttempts = opts.maxAttempts ?? 6
  }

  get endpoint(): string {
    return `https://${this.opts.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
  }

  async query<T>(query: string, variables: Record<string, unknown> = {}, cost = 100): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      // Leave room in the bucket rather than spending a request on THROTTLED.
      if (this.bucket && this.bucket.currentlyAvailable < cost && this.bucket.restoreRate > 0) {
        const wait = ((cost - this.bucket.currentlyAvailable) / this.bucket.restoreRate) * 1000
        await this.sleep(Math.ceil(wait))
        this.bucket = null
      }
      const res = await this.doFetch(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-access-token': this.opts.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      })
      if (res.status === 401) {
        throw new ShopifyError('Shopify rejected the access token. Check it and try again.', 'auth')
      }
      if (res.status === 403) {
        throw new ShopifyError('The token is missing an access scope this import needs.', 'scope')
      }
      if (res.status === 404) {
        throw new ShopifyError('No Shopify store answers at that domain.', 'not_found')
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= this.maxAttempts) {
          throw new ShopifyError(
            `Shopify kept answering ${res.status}; try again later.`,
            res.status === 429 ? 'throttled' : 'server',
          )
        }
        const retryAfter = Number(res.headers.get('retry-after'))
        await this.sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** (attempt - 1))
        continue
      }
      const body = (await res.json()) as GraphQLResponse<T>
      this.bucket = body.extensions?.cost?.throttleStatus ?? null
      const throttled = body.errors?.some((e) => e.extensions?.code === 'THROTTLED')
      if (throttled) {
        if (attempt >= this.maxAttempts) throw new ShopifyError('Shopify rate limit', 'throttled')
        const b = this.bucket
        const wait =
          b && b.restoreRate > 0 ? ((cost - b.currentlyAvailable) / b.restoreRate) * 1000 : 2000
        await this.sleep(Math.max(500, Math.ceil(wait)))
        this.bucket = null
        continue
      }
      if (body.errors?.length) {
        const message = body.errors.map((e) => e.message).join('; ')
        const denied = body.errors.some((e) => e.extensions?.code === 'ACCESS_DENIED')
        throw new ShopifyError(message, denied ? 'scope' : 'query')
      }
      if (!body.data) throw new ShopifyError('Shopify returned no data', 'server')
      return body.data
    }
  }

  /**
   * Every node of a connection, page by page. `pick` finds the connection in the
   * response; the query must take `$cursor: String` and select
   * `pageInfo { hasNextPage endCursor }` and `nodes`.
   */
  async *paginate<N>(
    query: string,
    pick: (data: unknown) => {
      nodes: N[]
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    },
    variables: Record<string, unknown> = {},
    cost = 100,
    /** Continue after a page the caller already has (nested connections). */
    after: string | null = null,
  ): AsyncGenerator<N[]> {
    let cursor: string | null = after
    for (;;) {
      const data = await this.query<unknown>(query, { ...variables, cursor }, cost)
      const page = pick(data)
      yield page.nodes
      if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) return
      cursor = page.pageInfo.endCursor
    }
  }
}
