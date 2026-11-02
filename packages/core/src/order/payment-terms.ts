import { z } from 'zod'

/**
 * "Payment due later" on a draft (#1029), like Shopify's payment terms: the order is placed now
 * and paid later, by a due date the terms set. Null terms mean the order is paid now.
 */
export const PAYMENT_TERMS = [
  'receipt',
  'fulfillment',
  'net_7',
  'net_15',
  'net_30',
  'net_45',
  'net_60',
  'net_90',
  'fixed',
] as const

export type PaymentTerms = (typeof PAYMENT_TERMS)[number]

export const PaymentTermsSchema = z.enum(PAYMENT_TERMS)

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * When payment is due for terms agreed at `placedAt`. 'receipt' is due at once; 'net_N' N days
 * later; 'fixed' on the date the merchant chose; 'fulfillment' has no date until it ships (null).
 */
export function paymentDueAt(
  terms: PaymentTerms,
  placedAt: Date,
  fixedDate?: Date | null,
): Date | null {
  if (terms === 'receipt') return placedAt
  if (terms === 'fulfillment') return null
  if (terms === 'fixed') return fixedDate ?? null
  const days = Number(terms.slice('net_'.length))
  return new Date(placedAt.getTime() + days * DAY_MS)
}

/** True once a due date has passed on an order still waiting for its money. */
export function paymentOverdue(dueAt: Date | null, now: Date): boolean {
  return dueAt !== null && dueAt.getTime() < now.getTime()
}
