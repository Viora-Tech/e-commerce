export type CourierErrorKind =
  | 'auth'
  | 'rate_limited'
  | 'unavailable'
  | 'timeout'
  | 'bad_response'
  | 'not_configured'
  | 'rejected'

/**
 * A courier call that did not produce an answer. Distinct from "the courier
 * said no" so callers can fall back to configured transit days instead of
 * telling a customer in a perfectly serviceable pincode that we cannot deliver.
 */
export class CourierError extends Error {
  readonly kind: CourierErrorKind
  readonly provider: string
  readonly status: number | undefined
  /** A refusal the admin can explain better than the sentence, with the facts it needs. */
  readonly detail: CourierErrorDetail | undefined
  /**
   * The courier's own words for a 4xx refusal ("Order already exists"), read from its error
   * body. Shown to staff only; a shopper never sees a courier's text.
   */
  readonly reason: string | undefined

  constructor(
    kind: CourierErrorKind,
    provider: string,
    message: string,
    options?: {
      status?: number | undefined
      cause?: unknown
      detail?: CourierErrorDetail | undefined
      reason?: string | undefined
    },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'CourierError'
    this.kind = kind
    this.provider = provider
    this.status = options?.status
    this.detail = options?.detail
    this.reason = options?.reason
  }
}

const REASON_KEYS = [
  'message',
  'msg',
  'remarks',
  'remark',
  'error',
  'errors',
  'description',
  'detail',
]
const MAX_REASON = 200

/** The first readable reason in a courier's JSON error body (nested one level), or null. */
function reasonFrom(value: unknown, depth = 0): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (depth > 2 || value === null || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    const parts = value.map((v) => reasonFrom(v, depth + 1)).filter((v): v is string => !!v)
    return parts.length ? parts.join('; ') : null
  }
  const record = value as Record<string, unknown>
  for (const key of REASON_KEYS) {
    const found = reasonFrom(record[key], depth + 1)
    if (found) return found
  }
  return null
}

/**
 * Why a courier refused a request, from its error body: the JSON message or remarks, else
 * short plain text. HTML error pages and empty bodies give undefined.
 */
export async function courierRefusalReason(response: Response): Promise<string | undefined> {
  const text = await response.text().catch(() => '')
  if (!text.trim()) return undefined
  let reason: string | null
  try {
    reason = reasonFrom(JSON.parse(text))
  } catch {
    reason = /<[a-z!]/i.test(text) ? null : text.trim()
  }
  if (!reason) return undefined
  const flat = reason.replace(/\s+/g, ' ')
  return flat.length > MAX_REASON ? `${flat.slice(0, MAX_REASON - 1)}…` : flat
}

/**
 * `no_pickup_location`: the courier has no pickup location (warehouse) by the name we sent; the
 * admin shows the exact name and where to find the right one on the courier's dashboard.
 */
export type CourierErrorDetail = { code: 'no_pickup_location'; pickupLocationName: string }

/**
 * Wall-clock budget for a courier call.
 *
 * The storefront is waiting on this behind a server action, so a courier that
 * hangs turns into a product page that looks broken. Six seconds is long enough
 * for a cold round-trip and short enough that the customer sees the fallback
 * rather than a spinner.
 */
export const COURIER_TIMEOUT_MS = 6_000

/**
 * Assumed parcel weight when a variant has none, in grams.
 *
 * 500g is a mid-range mouse in retail packaging - the modal product for the
 * first store on this platform. It only keeps a rate call from erroring; it is
 * not a substitute for the merchant entering real weights.
 */
export const ASSUMED_WEIGHT_GRAMS = 500

/**
 * fetch() with a hard timeout, uniform error mapping and no retries.
 *
 * No retries on purpose: the caller is a synchronous storefront request with
 * its own budget, and a retry against a rate-limited API makes the rate limit
 * worse. Retrying belongs in the background tracking job, not here.
 *
 * The URL is never included in an error message. It carries the PIN code and
 * the token-bearing host, and these messages end up in logs that are read more
 * widely than the credential store.
 */
export async function courierFetch(
  provider: string,
  url: string,
  init: RequestInit & {
    timeoutMs?: number | undefined
    fetchImpl?: typeof fetch | undefined
  } = {},
): Promise<Response> {
  const { timeoutMs = COURIER_TIMEOUT_MS, fetchImpl = fetch, ...rest } = init
  try {
    const response = await fetchImpl(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) })
    if (response.status === 401 || response.status === 403) {
      throw new CourierError('auth', provider, `${provider} rejected the credentials.`, {
        status: response.status,
      })
    }
    if (response.status === 429) {
      throw new CourierError('rate_limited', provider, `${provider} is rate limiting us.`, {
        status: response.status,
      })
    }
    if (!response.ok) {
      // A 4xx is the courier refusing what we sent: keep its reason for staff.
      const reason = response.status < 500 ? await courierRefusalReason(response) : undefined
      throw new CourierError(
        'unavailable',
        provider,
        reason
          ? `${provider} refused the request: ${reason}`
          : `${provider} returned HTTP ${response.status}.`,
        { status: response.status, reason },
      )
    }
    return response
  } catch (error) {
    if (error instanceof CourierError) throw error
    // AbortSignal.timeout rejects with a TimeoutError DOMException; every other
    // fetch rejection is a transport failure (DNS, TLS, connection reset).
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new CourierError(
        'timeout',
        provider,
        `${provider} did not answer within ${timeoutMs}ms.`,
        {
          cause: error,
        },
      )
    }
    throw new CourierError('unavailable', provider, `Could not reach ${provider}.`, {
      cause: error,
    })
  }
}

/** Parse a JSON body, turning a surprise HTML error page into a typed failure. */
export async function courierJson<T>(provider: string, response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch (error) {
    throw new CourierError(
      'bad_response',
      provider,
      `${provider} returned a non-JSON body (${text.slice(0, 120)}).`,
      { cause: error },
    )
  }
}
