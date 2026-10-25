/** SOURCE OF TRUTH: affiliate fraud guards — WHAT: self-referral checks on an order, the order risks that hold a commission (a code from a coupon site, a coupon spike, a blocked buyer) and blocklist values / WHY: an affiliate must not earn on their own purchases or on a code that leaked; every rule is pure so it is tested without a database */

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

/** Coupon and cashback sites a leaked code usually turns up on; the store can edit the list. */
export const DEFAULT_COUPON_SITES = [
  'grabon.in',
  'coupondunia.in',
  'cashkaro.com',
  'desidime.com',
  'couponzguru.com',
  'cuponation.in',
  'paisawapas.com',
  'zoutons.com',
  'freekaamaal.com',
  'dealsheaven.in',
]

/** Risks that hold a commission for the merchant to clear or reverse (flag-and-hold). */
export type OrderRisk = 'coupon_leak_site' | 'coupon_spike' | 'blocked_buyer'

/** The host of a referrer URL, lower case and without `www.`; null when it is not a URL. */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

/** Whether `host` is one of `sites` or a subdomain of one (`m.grabon.in` is GrabOn). */
export function isCouponSite(host: string | null, sites: readonly string[]): boolean {
  if (!host) return false
  return sites.some((s) => {
    const site = s
      .trim()
      .toLowerCase()
      .replace(/^www\./, '')
    return Boolean(site) && (host === site || host.endsWith(`.${site}`))
  })
}

/** The middle value (the mean of the two middle ones for an even count); 0 for none. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/** Fewer coupon orders than this in 24 hours are never a spike, however quiet the code was. */
export const SPIKE_MIN_ORDERS = 5

/**
 * A coupon spike: the code's orders in the last 24 hours pass `multiple` times its usual day
 * (the median of the 28 days before, counting days without orders; at least 1), and reach
 * `SPIKE_MIN_ORDERS`. A code shared on a coupon site behaves like this.
 */
export function isCouponSpike(
  last24h: number,
  dailyCounts: readonly number[],
  multiple: number,
): boolean {
  if (last24h < SPIKE_MIN_ORDERS) return false
  return last24h > multiple * Math.max(1, median(dailyCounts))
}

/** What can be blocked: a buyer's or applicant's email, domain, phone or IP; an affiliate's PAN or payee. */
export const BLOCKLIST_KINDS = ['email', 'email_domain', 'phone', 'ip', 'pan', 'payee'] as const
export type BlocklistKind = (typeof BLOCKLIST_KINDS)[number]

/**
 * The one spelling a blocklist value is compared in, or null when it is not a valid value of
 * its kind. A payee is a UPI id, or an account number and IFSC as `account@ifsc`.
 */
export function blocklistKey(kind: BlocklistKind, raw: string): string | null {
  const v = raw.trim()
  if (kind === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.toLowerCase() : null
  if (kind === 'email_domain') {
    const d = v.toLowerCase().replace(/^@/, '')
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null
  }
  if (kind === 'phone') return phoneKey(v)
  if (kind === 'ip') return /^[0-9a-f:.]{3,45}$/i.test(v) ? v.toLowerCase() : null
  if (kind === 'pan') {
    const pan = v.toUpperCase()
    return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan) ? pan : null
  }
  const payee = v.toLowerCase().replace(/\s+/g, '')
  return /^[\w.-]{2,64}@[a-z0-9.-]{2,40}$/.test(payee) ? payee : null
}

/** The masked line the admin shows for a blocked value: enough to recognise it, not to read it. */
export function blocklistHint(kind: BlocklistKind, key: string): string {
  if (kind === 'email_domain' || kind === 'ip') return key
  if (kind === 'email' || kind === 'payee') {
    const [user = '', rest = ''] = key.split('@')
    return `${user.slice(0, 2)}•••@${rest}`
  }
  return `•••${key.slice(-4)}`
}

/** Why an affiliate's payouts wait for the merchant's review. */
export const REVIEW_REASONS = [
  'duplicate_pan',
  'duplicate_payee',
  'blocked_phone',
  'blocked_pan',
  'blocked_payee',
] as const
export type ReviewReason = (typeof REVIEW_REASONS)[number]
