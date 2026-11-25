/**
 * SOURCE OF TRUTH KEYWORDS: snapmintRequest, SnapmintApiError, SNAPMINT_TIMEOUT_MS, Snapmint hosts
 * WHAT:  One call to Snapmint: the checkout host (carts), the API host (order status, refunds)
 *        or the ext host (Visibility V2), the merchant token or Basic header, a timeout, and an
 *        error carrying Snapmint's own code and message with the HTTP status.
 * WHY:   Every Snapmint call goes through here so hosts, auth and timeouts live in one place.
 *        Hosts and headers are from Snapmint's "Cardless EMI Integration Document" v20250722
 *        (sections 4.1, 5.1, 6.2-6.4) and "Visibility V2 Documentation".
 * WHERE: SnapmintProvider (snapmint.ts).
 */

/**
 * Section 5.1: the checkout (carts) host. Snapmint confirmed (23 Nov 2026) carts need no IP
 * allow-listing. The documented sandbox host pay.sandbox.snapmint.com answers every request with
 * a CloudFront 403, so sandbox uses apis.sandbox.snapmint.com, which serves the same /api/pub/carts.
 */
const PAY_HOSTS = {
  test: 'https://apis.sandbox.snapmint.com',
  live: 'https://pay.snapmint.com',
} as const

/** Sections 6.2-6.4: order status, refunds and refund status. */
const API_HOSTS = {
  test: 'https://sandboxapi.snapmint.com',
  live: 'https://api.snapmint.com',
} as const

/**
 * Visibility V2 (`POST /ext/v1/visibility`). Snapmint allow-lists our server IPs for it; until
 * then it refuses us, and the visibility check fails open.
 */
const EXT_HOSTS = {
  test: 'https://apis.sandbox.snapmint.com',
  live: 'https://apis.snapmint.com',
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

export type SnapmintKeys = {
  merchantId: string
  merchantKey: string
  merchantToken: string
  mode: 'test' | 'live'
}

export type SnapmintCall = {
  host: 'pay' | 'api' | 'ext'
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string> | undefined
  body?: unknown
  /** Override the default timeout (the visibility check gives up after 1.5 s). */
  timeoutMs?: number | undefined
  /**
   * Bearer merchant token by default; `basic` is `base64(mid:merchantKey)` (Visibility V2);
   * false for the carts call, which Snapmint authorises by merchant id and server IP.
   */
  auth?: boolean | 'basic' | undefined
  /** Extra headers, such as Visibility V2's `x-forwarded-for`. */
  headers?: Record<string, string> | undefined
}

const HOSTS = { pay: PAY_HOSTS, api: API_HOSTS, ext: EXT_HOSTS } as const

/** Visibility V2's `Authorization: Basic base64(mid:merchantSecret)`; the secret is the key. */
export const snapmintBasicAuth = (keys: Pick<SnapmintKeys, 'merchantId' | 'merchantKey'>) =>
  `Basic ${btoa(`${keys.merchantId}:${keys.merchantKey}`)}`

export async function snapmintRequest<T>(
  fetchImpl: typeof fetch,
  keys: SnapmintKeys,
  call: SnapmintCall,
): Promise<T> {
  const base = HOSTS[call.host][keys.mode]
  const url = new URL(call.path, base)
  for (const [k, v] of Object.entries(call.query ?? {})) url.searchParams.set(k, v)
  const headers: Record<string, string> = {
    ...call.headers,
    accept: 'application/json',
    'content-type': 'application/json',
  }
  if (call.auth === 'basic') headers.authorization = snapmintBasicAuth(keys)
  else if (call.auth !== false) headers.authorization = `Bearer ${keys.merchantToken}`
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
