/**
 * Decentro HTTP basics shared by collections and payouts. Official docs:
 * - Auth headers (`client_id`, `client_secret`) on every v3 call:
 *   https://docs.decentro.tech/reference/testing-credentials-v3
 * - Collections hosts (`staging.api.decentro.tech` / `api.decentro.tech`):
 *   https://docs.decentro.tech/reference/payments_api-collectionsv3-paymentlink
 * - Payouts hosts (`in.staging.decentro.tech` / `in.decentro.tech`):
 *   https://docs.decentro.tech/reference/payments_api-initiate-payout-v3
 */

export type DecentroMode = 'test' | 'live'

export const DECENTRO_HOSTS = {
  collections: { test: 'https://staging.api.decentro.tech', live: 'https://api.decentro.tech' },
  payouts: { test: 'https://in.staging.decentro.tech', live: 'https://in.decentro.tech' },
} as const

export type DecentroCredentials = {
  clientId: string
  clientSecret: string
  mode: DecentroMode
}

/** Every Decentro reply carries these; `api_status` (or `status` on refunds) is the call, not the money. */
export type DecentroEnvelope<T> = {
  decentro_txn_id?: string
  api_status?: string
  status?: string
  message?: string
  response_key?: string
  data?: T
}

export class DecentroApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseKey: string | null,
  ) {
    super(message)
    this.name = 'DecentroApiError'
  }
}

/** Response keys that mean "these keys are wrong", across the documented APIs. */
const AUTH_KEY = /client_id|client_secret|credential|authenticat|unauthori|api_access/

export const isAuthError = (err: DecentroApiError): boolean =>
  err.status === 401 || err.status === 403 || AUTH_KEY.test(err.responseKey ?? '')

/**
 * One call to Decentro. Throws `DecentroApiError` on a non-2xx reply or an
 * explicit `FAILURE` status; the caller decides what a transaction status means.
 */
export async function decentroRequest<T>(
  fetchImpl: typeof fetch,
  creds: DecentroCredentials,
  api: keyof typeof DECENTRO_HOSTS,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<DecentroEnvelope<T>> {
  const init: RequestInit = {
    method,
    headers: {
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      'content-type': 'application/json',
      accept: 'application/json',
    },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  const res = await fetchImpl(`${DECENTRO_HOSTS[api][creds.mode]}${path}`, init)
  const text = await res.text()
  let json: DecentroEnvelope<T> = {}
  if (text) {
    try {
      json = JSON.parse(text) as DecentroEnvelope<T>
    } catch {
      json = {}
    }
  }
  const callStatus = (json.api_status ?? json.status ?? '').toUpperCase()
  if (!res.ok || callStatus === 'FAILURE') {
    throw new DecentroApiError(
      json.message ?? `Decentro request failed (${res.status})`,
      res.status,
      json.response_key ?? null,
    )
  }
  return json
}

/** Rupees with 2 decimals, as Decentro's amount fields take them. */
export const rupees = (paise: number): number => Number((paise / 100).toFixed(2))

/** Decentro amounts are rupees; ours are integer paise. */
export const toPaise = (amount: number | string | null | undefined): number => {
  const n = typeof amount === 'string' ? Number(amount) : (amount ?? 0)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/**
 * Decentro rejects "unsanitized values" in narration fields (`. @ # $ % ^ & * ! ; : ' " ~ ` ? = + ) (`):
 * keep letters, digits and spaces, trimmed to `max`, padded to `min` with the fallback.
 */
export function narration(text: string, max: number, fallback: string, min = 1): string {
  const clean = text
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
  return clean.length >= min ? clean : fallback
}
