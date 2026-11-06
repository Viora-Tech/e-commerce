/** SOURCE OF TRUTH: Cloudflare custom hostnames client — WHAT: find / create / refresh / delete a custom hostname on the SaaS zone / WHY: a merchant domain only gets Cloudflare's protection once it is a custom hostname on our zone */

/*
 * Endpoints, checked against developers.cloudflare.com/api/resources/custom_hostnames (2026-11-06):
 * - `GET    /zones/{zone}/custom_hostnames?hostname.exact=` → list, `result[]`
 * - `POST   /zones/{zone}/custom_hostnames` `{ hostname, ssl }` → the new hostname
 * - `PATCH  /zones/{zone}/custom_hostnames/{id}` `{ ssl }` → the same `ssl` as the POST asks
 *   Cloudflare to validate again now (a `moved` or `blocked` hostname, a timed-out certificate)
 * - `DELETE /zones/{zone}/custom_hostnames/{id}` → removes it and its certificate
 * Auth: `Authorization: Bearer`, "SSL and Certificates: Edit". The token only ever goes in that
 * header: never in a URL, a log line or an error. Cloudflare's own error text is not echoed.
 */

import { CommerceError } from '../errors'

export type CloudflareConfig = {
  apiToken: string
  /** The zone with Cloudflare for SaaS turned on. */
  zoneId: string
}

/** The fields we read from a custom hostname; it has more. */
export type CustomHostname = {
  id: string
  hostname: string
  /** `pending`, `active`, `active_redeploying`, `moved`, `blocked`, `pending_blocked`, … */
  status: string
  verificationErrors: string[]
  /** `ownership_verification`: the TXT record that validates the hostname before DNS moves. */
  ownership: { name: string; value: string } | null
  ssl: {
    /** `initializing`, `pending_validation`, `active`, `validation_timed_out`, … */
    status: string
    validationErrors: string[]
    /** TXT `validation_records`, when the certificate wants them. */
    txt: { name: string; value: string }[]
  }
}

export type CloudflareHostnames = {
  find(hostname: string): Promise<CustomHostname | null>
  create(hostname: string): Promise<CustomHostname>
  /** Ask Cloudflare to validate again now. */
  refresh(id: string): Promise<CustomHostname>
  remove(id: string): Promise<void>
}

/** A Cloudflare call that failed: network, timeout, or a non-2xx or `success: false` answer. */
export class CloudflareError extends CommerceError {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super('CLOUDFLARE', message)
    this.status = status
  }

  /** Cloudflare looked at the request and said no; asking again unchanged will not help. */
  get refused(): boolean {
    const s = this.status
    return s !== null && s >= 400 && s < 500 && ![401, 403, 404, 408, 429].includes(s)
  }
}

const API = 'https://api.cloudflare.com/client/v4'
const TIMEOUT_MS = 8_000

/**
 * HTTP validation: Cloudflare serves the token itself once the CNAME is in place, so the merchant
 * adds nothing for the certificate. The API's own advice when the CNAME is there or on its way.
 */
const SSL = { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } } as const

type Fetch = (input: string, init: RequestInit) => Promise<Response>

/** The Cloudflare settings from env, or null when either is missing. */
export function cloudflareConfigFrom(env: {
  CLOUDFLARE_API_TOKEN?: string | undefined
  CLOUDFLARE_ZONE_ID?: string | undefined
}): CloudflareConfig | null {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) return null
  return { apiToken: env.CLOUDFLARE_API_TOKEN, zoneId: env.CLOUDFLARE_ZONE_ID }
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

const messages = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((v) => (v as { message?: unknown } | null)?.message)
        .filter((m): m is string => typeof m === 'string')
    : []

function asTxt(name: unknown, value: unknown): { name: string; value: string } | null {
  return typeof name === 'string' && name && typeof value === 'string' && value
    ? { name, value }
    : null
}

function asHostname(value: unknown): CustomHostname | null {
  const v = value as {
    id?: unknown
    hostname?: unknown
    status?: unknown
    verification_errors?: unknown
    ownership_verification?: { type?: unknown; name?: unknown; value?: unknown } | null
    ssl?: { status?: unknown; validation_errors?: unknown; validation_records?: unknown } | null
  } | null
  if (!v || typeof v.id !== 'string' || typeof v.hostname !== 'string') return null
  const records = Array.isArray(v.ssl?.validation_records) ? v.ssl.validation_records : []
  const owner = v.ownership_verification
  return {
    id: v.id,
    hostname: v.hostname,
    status: typeof v.status === 'string' ? v.status : 'pending',
    verificationErrors: strings(v.verification_errors),
    ownership: owner?.type === 'txt' ? asTxt(owner.name, owner.value) : null,
    ssl: {
      status: typeof v.ssl?.status === 'string' ? v.ssl.status : 'initializing',
      validationErrors: messages(v.ssl?.validation_errors),
      txt: records
        .map((r) => {
          const record = r as { txt_name?: unknown; txt_value?: unknown } | null
          return asTxt(record?.txt_name, record?.txt_value)
        })
        .filter((r): r is { name: string; value: string } => r !== null),
    },
  }
}

export function createCloudflareClient(
  config: CloudflareConfig,
  opts: { fetch?: Fetch | undefined; timeoutMs?: number | undefined } = {},
): CloudflareHostnames {
  const doFetch: Fetch = opts.fetch ?? ((input, init) => fetch(input, init))
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS
  const base = `${API}/zones/${encodeURIComponent(config.zoneId)}/custom_hostnames`

  const call = async (
    label: string,
    url: string,
    init: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
  ): Promise<unknown> => {
    let res: Response
    try {
      res = await doFetch(url, {
        method: init.method,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.apiToken}`,
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: init.body === undefined ? null : JSON.stringify(init.body),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      })
    } catch (err) {
      const timedOut = (err as { name?: unknown } | null)?.name === 'TimeoutError'
      throw new CloudflareError(
        timedOut
          ? `Cloudflare ${label} timed out after ${timeoutMs} ms`
          : `Cloudflare ${label} could not be reached`,
        null,
      )
    }
    // The status is enough to act on; the body is not echoed, in case it quotes the request.
    if (!res.ok) throw new CloudflareError(`Cloudflare ${label} answered ${res.status}`, res.status)
    const text = await res.text()
    if (!text) return null
    let body: { success?: unknown; result?: unknown }
    try {
      body = JSON.parse(text) as { success?: unknown; result?: unknown }
    } catch {
      throw new CloudflareError(`Cloudflare ${label} answered with something other than JSON`, null)
    }
    if (body.success === false) {
      throw new CloudflareError(`Cloudflare ${label} answered success: false`, null)
    }
    return body.result ?? null
  }

  const one = (label: string, result: unknown): CustomHostname => {
    const hostname = asHostname(result)
    if (!hostname)
      throw new CloudflareError(`Cloudflare ${label} answered without a hostname`, null)
    return hostname
  }

  return {
    async find(hostname) {
      const query = new URLSearchParams({ 'hostname.exact': hostname }).toString()
      const result = await call('custom_hostnames.list', `${base}?${query}`, { method: 'GET' })
      if (!Array.isArray(result)) {
        throw new CloudflareError('Cloudflare custom_hostnames.list did not answer a list', null)
      }
      return result.map(asHostname).find((h) => h?.hostname === hostname) ?? null
    },

    async create(hostname) {
      const label = 'custom_hostnames.create'
      return one(label, await call(label, base, { method: 'POST', body: { hostname, ssl: SSL } }))
    },

    async refresh(id) {
      const label = 'custom_hostnames.edit'
      const url = `${base}/${encodeURIComponent(id)}`
      return one(label, await call(label, url, { method: 'PATCH', body: { ssl: SSL } }))
    },

    async remove(id) {
      const label = 'custom_hostnames.delete'
      await call(label, `${base}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
  }
}
