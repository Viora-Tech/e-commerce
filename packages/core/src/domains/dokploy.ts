/** SOURCE OF TRUTH: Dokploy REST client for storefront domains — WHAT: list / create / delete the domains on the storefront application / WHY: Traefik only routes (and certifies) hostnames added to a Dokploy application */

/*
 * Endpoints (Dokploy `domain` router, checked against Dokploy's source 2026-10-07):
 * - `GET  /api/domain.byApplicationId?applicationId=` → the app's domains
 * - `POST /api/domain.create` (JSON) → the new domain; for an application Dokploy writes the
 *   Traefik config straight away (`manageDomain`), no redeploy
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
}

/** The fields we read from a Dokploy domain; it has more. */
export type DokployDomain = {
  domainId: string
  host: string
}

export type DokployClient = {
  listDomains(): Promise<DokployDomain[]>
  createDomain(host: string): Promise<DokployDomain>
  deleteDomain(domainId: string): Promise<void>
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
}): DokployConfig | null {
  if (!env.DOKPLOY_URL || !env.DOKPLOY_API_KEY || !env.DOKPLOY_STOREFRONT_APPLICATION_ID) {
    return null
  }
  return {
    url: env.DOKPLOY_URL,
    apiKey: env.DOKPLOY_API_KEY,
    applicationId: env.DOKPLOY_STOREFRONT_APPLICATION_ID,
    port: env.DOKPLOY_STOREFRONT_PORT,
  }
}

function apiBase(url: string): string {
  return `${url.replace(/\/+$/, '').replace(/\/api$/, '')}/api`
}

function asDomain(value: unknown): DokployDomain | null {
  const v = value as { domainId?: unknown; host?: unknown } | null
  if (!v || typeof v.domainId !== 'string' || typeof v.host !== 'string') return null
  return { domainId: v.domainId, host: v.host }
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

    async createDomain(host) {
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
        },
      })
      const created = asDomain(body)
      if (!created) throw new DokployError('Dokploy domain.create answered without a domain', null)
      return created
    },

    async deleteDomain(domainId) {
      await call('domain.delete', { method: 'POST', body: { domainId } })
    },
  }
}
