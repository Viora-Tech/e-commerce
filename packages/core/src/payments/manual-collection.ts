/** SOURCE OF TRUTH: manual payment details — WHAT: how a merchant was paid when marking an order paid (method, UTR, date) / WHY: the timeline and "Payments by method" read the same shape */
/**
 * How the merchant was paid when they record money by hand ("Collect payment →
 * Mark as paid"): the method, an optional bank reference or UTR, and the day it
 * arrived. Pure and browser-safe (`@commerce/core/manual-payments`).
 *
 * Stored on the payment row under `checkout_session.collected`, so no migration
 * is needed. Every reader of `checkout_session` switches on its `kind`, which
 * this key never touches, so a gateway session on the same row stays intact.
 */

export const MANUAL_PAYMENT_METHODS = [
  'upi',
  'bank_transfer',
  'cash',
  'cheque',
  /** Taken from the customer's store credit balance (`payOrderWithStoreCredit`). */
  'store_credit',
  'other',
] as const
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number]

export type ManualCollection = {
  method: ManualPaymentMethod
  /** UTR, cheque number or any note that finds the money in a bank statement. */
  reference?: string | undefined
  /** The day the money arrived, `YYYY-MM-DD`. */
  receivedOn?: string | undefined
  /** Email of the staff member who recorded it. */
  recordedBy?: string | undefined
  /** ISO time it was recorded, which places it on the order timeline. */
  recordedAt?: string | undefined
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function isManualPaymentMethod(v: unknown): v is ManualPaymentMethod {
  return typeof v === 'string' && (MANUAL_PAYMENT_METHODS as readonly string[]).includes(v)
}

/** A real calendar day in `YYYY-MM-DD` form. */
export function isIsoDay(v: string): boolean {
  if (!ISO_DAY.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** What was recorded on a payment row, or null for anything that is not a manual collection. */
export function readManualCollection(checkoutSession: unknown): ManualCollection | null {
  if (!checkoutSession || typeof checkoutSession !== 'object') return null
  const c = (checkoutSession as { collected?: unknown }).collected
  if (!c || typeof c !== 'object') return null
  const { method, reference, receivedOn, recordedBy, recordedAt } = c as Record<string, unknown>
  if (!isManualPaymentMethod(method)) return null
  return {
    method,
    reference: typeof reference === 'string' && reference ? reference : undefined,
    receivedOn: typeof receivedOn === 'string' && isIsoDay(receivedOn) ? receivedOn : undefined,
    recordedBy: typeof recordedBy === 'string' && recordedBy ? recordedBy : undefined,
    recordedAt:
      typeof recordedAt === 'string' && !Number.isNaN(Date.parse(recordedAt))
        ? recordedAt
        : undefined,
  }
}

/** The session with the collection added; whatever the gateway stored is kept. */
export function withManualCollection(
  checkoutSession: unknown,
  collected: ManualCollection,
): Record<string, unknown> {
  const base =
    checkoutSession && typeof checkoutSession === 'object'
      ? (checkoutSession as Record<string, unknown>)
      : {}
  const clean: ManualCollection = { method: collected.method }
  const reference = collected.reference?.trim()
  if (reference) clean.reference = reference
  if (collected.receivedOn && isIsoDay(collected.receivedOn))
    clean.receivedOn = collected.receivedOn
  if (collected.recordedBy) clean.recordedBy = collected.recordedBy
  if (collected.recordedAt) clean.recordedAt = collected.recordedAt
  return { ...base, collected: clean }
}

/**
 * The key "Payments by method" groups a captured payment under: the method the
 * merchant recorded, else the provider that took it (`razorpay`, `cod`, …).
 */
export function paymentMethodKey(p: { provider: string; checkoutSession: unknown }): string {
  return readManualCollection(p.checkoutSession)?.method ?? p.provider
}
