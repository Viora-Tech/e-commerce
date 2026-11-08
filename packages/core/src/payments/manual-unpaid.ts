/** SOURCE OF TRUTH: one unpaid manual transfer per shopper — WHAT: the shopper's open, unpaid UPI or bank transfer order in this store (matched by email or phone), and the error `placeOrder` throws instead of creating another / WHY: shoppers who never pay a transfer were placing order after order, each holding stock until it was cancelled */
import { order } from '@commerce/db'
import { or, type SQL, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'

/**
 * A manual transfer order was refused: this shopper already has one waiting for payment.
 * The storefront says "You already have an unpaid order #N" and, when the signed-in shopper
 * owns that order, links its status page. Other ways to pay are unaffected.
 */
export class UnpaidTransferExists extends CommerceError {
  readonly orderId: string
  readonly orderNumber: number
  /** The order's customer, so the storefront links it only for that signed-in shopper. */
  readonly customerId: string | null

  constructor(
    o: { id: string; number: number; customerId: string | null },
    storeId?: string | undefined,
  ) {
    super(
      'UNPAID_TRANSFER_EXISTS',
      `Order #${o.number} is still waiting for a UPI or bank transfer`,
      { storeId },
    )
    this.orderId = o.id
    this.orderNumber = o.number
    this.customerId = o.customerId
  }
}

/** Digits only, the last ten: `+91 98765-43210`, `09876543210` and `9876543210` all match. */
export function phoneKey(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length >= 6 ? digits.slice(-10) : null
}

/** Trimmed and lower-cased; null when empty. */
function emailKey(raw: string | null | undefined): string | null {
  const e = (raw ?? '').trim().toLowerCase()
  return e || null
}

export type CheckoutContactKeys = {
  email: string | null | undefined
  phone: string | null | undefined
}

/** Orders whose email or phone is this shopper's, normalised; null when there is nothing to match. */
export function orderContactMatch(contact: CheckoutContactKeys): SQL | null {
  const email = emailKey(contact.email)
  const phone = phoneKey(contact.phone)
  const matches: SQL[] = []
  if (email) matches.push(sql`lower(trim(${order.email})) = ${email}`)
  if (phone) {
    matches.push(sql`right(regexp_replace(${order.phone}, '[^0-9]', '', 'g'), 10) = ${phone}`)
  }
  return matches.length > 0 ? (or(...matches) ?? null) : null
}

/** Both the email and the phone on the order are this shopper's (a guest's stronger claim). */
export function sameEmailAndPhone(
  o: { email: string | null; phone: string | null },
  contact: CheckoutContactKeys,
): boolean {
  const email = emailKey(contact.email)
  const phone = phoneKey(contact.phone)
  return (
    email !== null && phone !== null && emailKey(o.email) === email && phoneKey(o.phone) === phone
  )
}
