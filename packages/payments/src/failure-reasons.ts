/**
 * SOURCE OF TRUTH KEYWORDS: website not registered, payment_risk_check_failed, failure reason
 * WHAT:  Recognises a gateway failure the merchant can fix themselves, from the reason text
 *        stored on the payment attempt (`payment.error`).
 * WHY:   Razorpay blocks a live payment made from a website that is not listed on the
 *        merchant's account (Account & Settings → Website and app details) and has no API to
 *        add one. Its words: "Payment blocked as website does not match registered
 *        website(s)", reason `payment_risk_check_failed`. The API warns on Settings → Payments
 *        and the order page explains the failed attempt.
 * WHERE: Pure, no imports: the admin (client) imports it through `@commerce/payments/failure-reasons`.
 */
export function isWebsiteNotRegistered(error: string | null | undefined): boolean {
  if (!error || !/website/i.test(error)) return false
  return /does not match|not registered|payment_risk_check_failed/i.test(error)
}

/** Status codes a gateway answers with when it refuses the merchant's API keys. */
const KEYS_REFUSED_STATUS = new Set([401])

/** Gateway words for refused keys (Razorpay's 401 says "Authentication failed"). */
const KEYS_REFUSED_TEXT = /authentication failed|invalid api key|invalid key|unauthori[sz]ed/i

/**
 * SOURCE OF TRUTH KEYWORDS: gateway keys rejected, merchant configuration error, 401
 * WHAT:  True when a gateway refused the call because of the merchant's API keys (Razorpay's 401
 *        "Authentication failed" when an order is created, or the same from Cashfree), not
 *        because of anything the shopper did.
 * WHY:   Broken keys failed every checkout instantly and the shopper was told their payment did
 *        not go through, so each retry made another unpaid order (Waimers, 7 Nov 2026). This is
 *        the merchant's to fix: checkout hides the gateway and the owner is told.
 */
export function isGatewayKeysRefused(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const o = err as { statusCode?: unknown; status?: unknown }
    if (KEYS_REFUSED_STATUS.has(Number(o.statusCode)) || KEYS_REFUSED_STATUS.has(Number(o.status)))
      return true
  }
  const text =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : err && typeof err === 'object'
          ? String(
              (err as { error?: { description?: unknown } }).error?.description ??
                (err as { message?: unknown }).message ??
                '',
            )
          : ''
  return KEYS_REFUSED_TEXT.test(text)
}

/** How a payment attempt's `error` starts when the gateway refused the store's keys. */
export const KEYS_REFUSED_PREFIX = 'The payment gateway rejected the store’s API keys'

/** The `error` stored on an attempt the gateway refused for the store's keys. */
export const keysRefusedError = (gatewayWords: string): string =>
  `${KEYS_REFUSED_PREFIX} (${gatewayWords}). Re-enter them in Settings → Payments.`

/** True for an attempt's stored `error` written by `keysRefusedError`. */
export const isKeysRefusedError = (error: string | null | undefined): boolean =>
  !!error?.startsWith(KEYS_REFUSED_PREFIX)
