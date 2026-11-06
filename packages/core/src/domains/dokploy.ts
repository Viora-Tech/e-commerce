/** SOURCE OF TRUTH: Dokploy REST client for storefront domains — WHAT: list / create / delete the domains on the storefront application / WHY: Traefik only routes (and certifies) hostnames added to a Dokploy application */

/*
 * Endpoints (Dokploy `domain` router, checked against Dokploy's source 2026-10-07):
 * - `GET  /api/domain.byApplicationId?applicationId=` → the app's domains
 * - `POST /api/domain.create` (JSON) → the new domain; for an application Dokploy writes the
 *   Traefik config straight away (`manageDomain`), no redeploy. `middlewares` (names, added to
 *   the HTTPS router) exists from Dokploy 0.29.0; older releases drop the field silently, so a
 *   create that asked for one checks the answer has it (`createDomain` below)
 * - `POST /api/domain.delete` `{ domainId }` → removes it and its Traefik config
 * Auth: `x-api-key` header (Dokploy → Settings → Profile → API/CLI).
 *
 * The API key only ever goes in that header: never in a URL, a log line or an error.
 */

import { CommerceError } from '../errors'

export type DokployConfig = {
  /** Dokploy's base URL, e.g. `https://dokploy.example.com` (a trailing `/api` is accepted). */
  url: string
  apiKey: string
  /** The storefront application's id in Dokploy. */
  applicationId: string
  /** The port the storefront container listens on. */
  port: number
  /** Traefik middleware that sends an apex to its www; set when an apex is redirect-only. */
  apexMiddleware?: string | undefined
}

/** The fields we read from a Dokploy domain; it has more. */
export type DokployDomain = {
  domainId: string
  host: string
  middlewares?: string[] | undefined
}

export type DokployClient = {
  listDomains(): Promise<DokployDomain[]>
  createDomain(host: string, opts?: { middlewares?: string[] | undefined }): Promise<DokployDomain>
  deleteDomain(domainId: string): Promise<void>
  /** Set when an apex only redirects; `routes.ts` puts it on those routes. */
  apexMiddleware?: string | undefined
}

/** A Dokploy call that failed: network, timeout or a non-2xx answer. Retry later. */
class DokployError extends CommerceError {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super('DOKPLOY', message)
    this.status = status
  }
}

const TIMEOUT_MS = 10_000

/**
 * The one Traefik middleware every redirect-only apex route references. It lives in a file on
 * the server (developer docs, Custom domains), not in Dokploy.
 */
const APEX_REDIRECT_MIDDLEWARE = 'apex-to-www@file'

type Fetch = (input: string, init: RequestInit) => Promise<Response>

/**
 * The Dokploy settings from env, or null when any of them is missing: then the route step
 * is skipped and domains behave as before (someone adds the route by hand).
 */
export function dokployConfigFrom(env: {
  DOKPLOY_URL?: string | undefined
  DOKPLOY_API_KEY?: string | undefined
  DOKPLOY_STOREFRONT_APPLICATION_ID?: string | undefined
  DOKPLOY_STOREFRONT_PORT: number
  DOMAIN_PROVIDER?: string | undefined
}): DokployConfig | null {
  if (!env.DOKPLOY_URL || !env.DOKPLOY_API_KEY || !env.DOKPLOY_STOREFRONT_APPLICATION_ID) {
    return null
  }
  return {
    url: env.DOKPLOY_URL,
    apiKey: env.DOKPLOY_API_KEY,
    applicationId: env.DOKPLOY_STOREFRONT_APPLICATION_ID,
    port: env.DOKPLOY_STOREFRONT_PORT,
    ...(env.DOMAIN_PROVIDER === 'cloudflare' ? { apexMiddleware: APEX_REDIRECT_MIDDLEWARE } : {}),
  }
}

function apiBase(url: string): string {
  return `${url.replace(/\/+$/, '').replace(/\/api$/, '')}/api`
}

function asDomain(value: unknown): DokployDomain | null {
  const v = value as { domainId?: unknown; host?: unknown; middlewares?: unknown } | null
  if (!v || typeof v.domainId !== 'string' || typeof v.host !== 'string') return null
  const domain = { domainId: v.domainId, host: v.host }
  return Array.isArray(v.middlewares)
    ? { ...domain, middlewares: v.middlewares.filter((m) => typeof m === 'string') }
    : domain
}

export function createDokployClient(
  config: DokployConfig,
  opts: { fetch?: Fetch | undefined; timeoutMs?: number | undefined } = {},
): DokployClient {
  const doFetch: Fetch = opts.fetch ?? ((input, init) => fetch(input, init))
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS
  const base = apiBase(config.url)

  const call = async (
    procedure: string,
    init: { method: 'GET' | 'POST'; query?: Record<string, string>; body?: unknown },
  ): Promise<unknown> => {
    const qs = init.query ? `?${new URLSearchParams(init.query).toString()}` : ''
    let res: Response
    try {
      res = await doFetch(`${base}/${procedure}${qs}`, {
        method: init.method,
        headers: {
          accept: 'application/json',
          'x-api-key': config.apiKey,
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: init.body === undefined ? null : JSON.stringify(init.body),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      })
    } catch (err) {
      const timedOut = (err as { name?: unknown } | null)?.name === 'TimeoutError'
      throw new DokployError(
        timedOut
          ? `Dokploy ${procedure} timed out after ${timeoutMs} ms`
          : `Dokploy ${procedure} could not be reached`,
        null,
      )
    }
    if (!res.ok) {
      // The status is enough to act on; the body is not echoed, in case it quotes the request.
      throw new DokployError(`Dokploy ${procedure} answered ${res.status}`, res.status)
    }
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new DokployError(`Dokploy ${procedure} answered with something other than JSON`, null)
    }
  }

  return {
    apexMiddleware: config.apexMiddleware,

    async listDomains() {
      const body = await call('domain.byApplicationId', {
        method: 'GET',
        query: { applicationId: config.applicationId },
      })
      if (!Array.isArray(body)) {
        throw new DokployError('Dokploy domain.byApplicationId did not answer a list', null)
      }
      return body.map(asDomain).filter((d): d is DokployDomain => d !== null)
    },

    async createDomain(host, createOpts = {}) {
      const middlewares = createOpts.middlewares ?? []
      const body = await call('domain.create', {
        method: 'POST',
        body: {
          host,
          path: '/',
          internalPath: '/',
          stripPath: false,
          port: config.port,
          https: true,
          certificateType: 'letsencrypt',
          applicationId: config.applicationId,
          domainType: 'application',
          ...(middlewares.length > 0 ? { middlewares } : {}),
        },
      })
      const created = asDomain(body)
      if (!created) throw new DokployError('Dokploy domain.create answered without a domain', null)
      if (middlewares.some((m) => !created.middlewares?.includes(m))) {
        // A redirect-only host must never be left serving the storefront.
        await call('domain.delete', { method: 'POST', body: { domainId: created.domainId } })
        throw new DokployError(
          'Dokploy ignored middlewares: it needs version 0.29.0 or later',
          null,
        )
      }
      return created
    },

    async deleteDomain(domainId) {
      await call('domain.delete', { method: 'POST', body: { domainId } })
    },
  }
}
