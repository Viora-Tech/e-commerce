/**
 * SOURCE OF TRUTH KEYWORDS: readableError, gateway error text, payment.error
 * WHAT:  The words to store and show for anything a gateway SDK throws.
 * WHY:   Gateway SDKs (Razorpay's among them) reject with plain objects such as
 *        `{ statusCode, error: { code, description } }`; `String(err)` turned those into
 *        "[object Object]" on the payment row, which tells the merchant nothing.
 * WHERE: Core payment attempts and the webhook pipeline, wherever an error becomes `error` text.
 */
export function readableError(err: unknown): string {
  if (typeof err === 'string') return err || 'Unknown error'
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    const inner = o.error && typeof o.error === 'object' ? (o.error as Record<string, unknown>) : {}
    const text = [inner.description, inner.message, o.description, o.message, o.error].find(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    )
    if (text) return text
    try {
      const json = JSON.stringify(err)
      if (json && json !== '{}') return json.slice(0, 500)
    } catch {
      // A circular object: fall through to the generic text.
    }
  }
  return err === undefined || err === null ? 'Unknown error' : String(err)
}
