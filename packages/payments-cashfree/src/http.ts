/**
 * SOURCE OF TRUTH KEYWORDS: cashfreeRequest, CashfreeApiError, CASHFREE_TIMEOUT_MS
 * WHAT:  One call to Cashfree's PG API: hosts, auth and version headers, a timeout, and the
 *        error with Cashfree's own message and the HTTP status.
 * WHY:   Split out of cashfree.ts (file-size cap). Hosts and headers as in cashfree.ts's header.
 * WHERE: CashfreeProvider (cashfree.ts) for orders, payments, refunds and settlements.
 */

const SANDBOX_HOST = 'https://sandbox.cashfree.com/pg'
const PROD_HOST = 'https://api.cashfree.com/pg'
const API_VERSION = '2026-01-01'

/** How long one Cashfree call may take before we give up on it (#1594). */
export const CASHFREE_TIMEOUT_MS = 15_000

export class CashfreeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type CashfreeKeys = { appId: string; secretKey: string; mode: 'test' | 'live' }

export async function cashfreeRequest<T>(
  fetchImpl: typeof fetch,
  keys: CashfreeKeys,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const host = keys.mode === 'live' ? PROD_HOST : SANDBOX_HOST
  const init: RequestInit = {
    method,
    headers: {
      'x-client-id': keys.appId,
      'x-client-secret': keys.secretKey,
      'x-api-version': API_VERSION,
      'content-type': 'application/json',
      ...extraHeaders,
    },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  // A stuck connection must not hang checkout, the expiry job or a refund (#1594).
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CASHFREE_TIMEOUT_MS)
  init.signal = controller.signal
  let res: Response
  let text: string
  try {
    res = await fetchImpl(`${host}${path}`, init)
    text = await res.text()
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Cashfree did not answer in ${CASHFREE_TIMEOUT_MS / 1000}s`)
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
  if (!res.ok) {
    const message =
      (json as { message?: string })?.message ?? `Cashfree request failed (${res.status})`
    throw new CashfreeApiError(message, res.status)
  }
  return json as T
}
