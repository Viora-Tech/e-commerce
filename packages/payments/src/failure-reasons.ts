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
