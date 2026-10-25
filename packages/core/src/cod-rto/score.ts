/** SOURCE OF TRUTH: RTO risk score — WHAT: the pure 0 to 100 score of how likely an order's parcel is to come back (return to origin), from the PIN code's RTO history in this store's own shipments, the shopper's past RTOs, cancellations and deliveries, the address's quality, the order value, a first order and the payment method; its level and the reasons / WHY: checkout (the COD rule), the order page and the risky-orders list must give the same score for the same facts, and it is unit tested without a database. */
import type { RiskLevel } from './settings'

/** What the store's own past shipments to this PIN code say. */
export type PincodeHistory = {
  /** Parcels to this PIN that reached an end: delivered or came back. */
  finished: number
  /** Of those, came back undelivered (RTO). */
  rto: number
}

/** This shopper's earlier orders in the store (matched by phone or email), this one left out. */
export type ShopperHistory = {
  orders: number
  cancelled: number
  delivered: number
  rto: number
}

export type RiskInput = {
  pincode: PincodeHistory
  shopper: ShopperHistory
  address: { line1: string; line2?: string | null | undefined }
  /** Items after discount plus shipping, in paise. */
  orderValuePaise: number
  paymentMethod: string | null
}

export type RiskFactorCode =
  | 'pincode_rto_high'
  | 'pincode_rto_some'
  | 'pincode_rto_few'
  | 'shopper_rto'
  | 'shopper_rto_repeat'
  | 'shopper_cancellations'
  | 'shopper_delivered'
  | 'address_short'
  | 'address_no_number'
  | 'order_value_high'
  | 'order_value_very_high'
  | 'first_order'
  | 'prepaid'

export type RiskFactor = { code: RiskFactorCode; points: number }

export type RiskScore = { score: number; level: RiskLevel; factors: RiskFactor[] }

/** A PIN code's rate is only trusted after this many finished parcels. */
const PINCODE_MIN_SAMPLE = 5

/** Fewer letters and digits than this in the street lines is too short to find the door. */
const ADDRESS_MIN_CHARS = 15

const RUPEE = 100

/** The weights, in one place so the merchant guide can describe them. */
const RISK_POINTS = {
  pincodeHigh: 35,
  pincodeSome: 20,
  pincodeFew: 10,
  shopperRto: 30,
  shopperRtoRepeat: 45,
  shopperCancellations: 10,
  shopperDelivered: -15,
  addressShort: 10,
  addressNoNumber: 10,
  valueHigh: 10,
  valueVeryHigh: 15,
  firstOrder: 10,
} as const

/** Order values that add points, in paise: above ₹5,000 and above ₹10,000. */
const RISK_VALUE_STEPS = { high: 5_000 * RUPEE, veryHigh: 10_000 * RUPEE } as const

/**
 * What is wrong with an address, if anything: too short to deliver to, or no house, flat or
 * plot number (no digit anywhere in the street lines). Indian couriers return most parcels
 * they cannot find.
 */
function addressIssues(address: RiskInput['address']): ('short' | 'no_number')[] {
  const text = `${address.line1} ${address.line2 ?? ''}`
  const issues: ('short' | 'no_number')[] = []
  if (text.replace(/[^\p{L}\p{N}]/gu, '').length < ADDRESS_MIN_CHARS) issues.push('short')
  if (!/\p{N}/u.test(text)) issues.push('no_number')
  return issues
}

function pincodeFactor(h: PincodeHistory): RiskFactor | null {
  if (h.finished >= PINCODE_MIN_SAMPLE) {
    const rate = h.rto / h.finished
    if (rate >= 0.3) return { code: 'pincode_rto_high', points: RISK_POINTS.pincodeHigh }
    if (rate >= 0.15) return { code: 'pincode_rto_some', points: RISK_POINTS.pincodeSome }
    return null
  }
  return h.rto >= 2 ? { code: 'pincode_rto_few', points: RISK_POINTS.pincodeFew } : null
}

function shopperFactors(h: ShopperHistory): RiskFactor[] {
  const out: RiskFactor[] = []
  if (h.orders === 0) return [{ code: 'first_order', points: RISK_POINTS.firstOrder }]
  if (h.rto >= 2) out.push({ code: 'shopper_rto_repeat', points: RISK_POINTS.shopperRtoRepeat })
  else if (h.rto === 1) out.push({ code: 'shopper_rto', points: RISK_POINTS.shopperRto })
  if (h.cancelled >= 2) {
    out.push({ code: 'shopper_cancellations', points: RISK_POINTS.shopperCancellations })
  }
  if (h.delivered >= 2 && h.rto === 0) {
    out.push({ code: 'shopper_delivered', points: RISK_POINTS.shopperDelivered })
  }
  return out
}

/** The level a score falls in, from the store's thresholds. */
function riskLevel(score: number, t: { mediumAt: number; highAt: number }): RiskLevel {
  if (score >= t.highAt) return 'high'
  if (score >= t.mediumAt) return 'medium'
  return 'low'
}

/**
 * The score: points per reason, summed and kept between 0 and 100. A prepaid order is
 * scored at half, since the money is already in and the shopper chose to pay. Factors come
 * back biggest first, which is how the admin lists them.
 */
export function scoreRtoRisk(
  input: RiskInput,
  thresholds: { mediumAt: number; highAt: number },
): RiskScore {
  const factors: RiskFactor[] = []
  const pin = pincodeFactor(input.pincode)
  if (pin) factors.push(pin)
  factors.push(...shopperFactors(input.shopper))
  for (const issue of addressIssues(input.address)) {
    factors.push(
      issue === 'short'
        ? { code: 'address_short', points: RISK_POINTS.addressShort }
        : { code: 'address_no_number', points: RISK_POINTS.addressNoNumber },
    )
  }
  if (input.orderValuePaise > RISK_VALUE_STEPS.veryHigh) {
    factors.push({ code: 'order_value_very_high', points: RISK_POINTS.valueVeryHigh })
  } else if (input.orderValuePaise > RISK_VALUE_STEPS.high) {
    factors.push({ code: 'order_value_high', points: RISK_POINTS.valueHigh })
  }
  const raw = Math.max(
    0,
    factors.reduce((sum, f) => sum + f.points, 0),
  )
  const prepaid = input.paymentMethod !== null && input.paymentMethod !== 'cod'
  const capped = Math.min(100, raw)
  const score = prepaid ? Math.round(capped / 2) : capped
  if (prepaid && capped > 0) factors.push({ code: 'prepaid', points: score - capped })
  factors.sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || a.code.localeCompare(b.code))
  return { score, level: riskLevel(score, thresholds), factors }
}
