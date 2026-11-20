/**
 * SOURCE OF TRUTH KEYWORDS: snapmintRequest, SnapmintApiError, SNAPMINT_TIMEOUT_MS, Snapmint hosts
 * WHAT:  One call to Snapmint: the checkout host (carts) or the API host (order status, refunds,
 *        visibility), the merchant token header, a timeout, and an error carrying Snapmint's own
 *        code and message with the HTTP status.
 * WHY:   Every Snapmint call goes through here so hosts, auth and timeouts live in one place.
 *        Hosts and headers are from Snapmint's "Cardless EMI Integration Document" v20250722
 *        (sections 4.1, 5.1, 6.2-6.4, 8.3).
 * WHERE: SnapmintProvider (snapmint.ts).
 */

/** Section 5.1: the checkout (carts) host. Only callable from the merchant's whitelisted server IP. */
const PAY_HOSTS = {
  test: 'https://pay.sandbox.snapmint.com',
  live: 'https://pay.snapmint.com',
} as const

/** Sections 6.2-6.4 and 8.3: order status, refunds, refund status and visibility. */
const API_HOSTS = {
  test: 'https://sandboxapi.snapmint.com',
  live: 'https://api.snapmint.com',
} as const

/** How long one Snapmint call may take before we give up on it. */
export const SNAPMINT_TIMEOUT_MS = 15_000

export class SnapmintApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Snapmint's code: `SNM0002`, `DUPLICATE_MERCHANT_OID`, `INVALID_MOBILE`… */
    readonly code: string | null,
  ) {
    super(message)
  }
}

export type SnapmintKeys = { merchantToken: string; mode: 'test' | 'live' }

export type SnapmintCall = {
  host: 'pay' | 'api'
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string> | undefined
  body?: unknown
  /** Override the default timeout (the visibility check gives up after 1.5 s). */
  timeoutMs?: number | undefined
  /** False for the carts call, which Snapmint authorises by merchant id and server IP. */
  auth?: boolean | undefined
}

export async function snapmintRequest<T>(
  fetchImpl: typeof fetch,
  keys: SnapmintKeys,
  call: SnapmintCall,
): Promise<T> {
  const base = (call.host === 'pay' ? PAY_HOSTS : API_HOSTS)[keys.mode]
  const url = new URL(call.path, base)
  for (const [k, v] of Object.entries(call.query ?? {})) url.searchParams.set(k, v)
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  }
  if (call.auth !== false) headers.authorization = `Bearer ${keys.merchantToken}`
  const init: RequestInit = { method: call.method, headers }
  if (call.body !== undefined) init.body = JSON.stringify(call.body)
  const timeoutMs = call.timeoutMs ?? SNAPMINT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  init.signal = controller.signal
  let res: Response
  let text: string
  try {
    res = await fetchImpl(url.toString(), init)
    text = await res.text()
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Snapmint did not answer in ${timeoutMs / 1000}s`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
  let json: unknown = {}
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = {}
    }
  }
  const o = (json ?? {}) as { status?: unknown; message?: unknown; code?: unknown }
  // Section 4.2: errors come as `{ status: "Error", message, code }`, sometimes with a 200.
  const failed = !res.ok || (typeof o.status === 'string' && o.status.toLowerCase() === 'error')
  if (failed) {
    const code = typeof o.code === 'string' && o.code ? o.code : null
    const words = typeof o.message === 'string' && o.message ? o.message : null
    const message = [words ?? `Snapmint request failed (${res.status})`, code ? `(${code})` : null]
      .filter(Boolean)
      .join(' ')
    throw new SnapmintApiError(message, res.ok ? 400 : res.status, code)
  }
  return json as T
}
