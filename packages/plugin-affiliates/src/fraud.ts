/** SOURCE OF TRUTH: affiliate fraud guards — WHAT: self-referral checks on an order / WHY: an affiliate must not earn on their own purchases */

/**
 * Pure. An affiliate buying through their own link or code is the most common abuse. An order
 * is a self-referral when it is the affiliate's own customer account, email, phone (compared
 * by blind index, never in the clear) or a shipping address they saved.
 */
export type AffiliateIdentity = {
  customerId: string | null
  email: string | null
  /** `phoneBlindIndex` of the last ten digits. */
  phoneIndex: string | null
  /** `addressKey` of every address the affiliate saved. */
  addressKeys: string[]
}

export type OrderIdentity = {
  customerId: string | null
  email: string | null
  phoneIndex: string | null
  addressKey: string | null
}

export type FraudFinding = 'own_account' | 'same_email' | 'same_phone' | 'same_address'

/** Indian mobile numbers as the last ten digits, so "+91 98765 43210" and "09876543210" match. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : null
}

/** First address line and PIN code, squashed, so "12, MG Road" and "12 mg road" match. */
export function addressKey(line1: string | null | undefined, pincode: string | null | undefined) {
  const l = (line1 ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const p = (pincode ?? '').replace(/\D/g, '')
  return l && p ? `${l}|${p}` : null
}

const sameEmail = (a: string | null, b: string | null) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase())

/** The first reason the order looks like the affiliate's own, or null. */
export function selfReferral(
  affiliate: AffiliateIdentity,
  order: OrderIdentity,
): FraudFinding | null {
  if (affiliate.customerId && affiliate.customerId === order.customerId) return 'own_account'
  if (sameEmail(affiliate.email, order.email)) return 'same_email'
  if (affiliate.phoneIndex && affiliate.phoneIndex === order.phoneIndex) return 'same_phone'
  if (order.addressKey && affiliate.addressKeys.includes(order.addressKey)) return 'same_address'
  return null
}
