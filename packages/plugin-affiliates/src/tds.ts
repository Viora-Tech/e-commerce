/** SOURCE OF TRUTH: TDS on affiliate commission — WHAT: tax deducted per approved commission and the Indian financial year it falls in / WHY: payouts and the CSV must show the same net */
import { dayStart, wallClock } from '@commerce/dates'
import type { AffiliateSettings } from './settings'

/**
 * Pure. TDS is deducted when commission is credited (approved), not when it is paid. Once an
 * affiliate's commission in the financial year passes the threshold (₹20,000 from April
 * 2025), TDS is due on the year's whole amount, so the first commission over the line
 * catches up on the earlier ones. Without a PAN the higher rate applies.
 */
export function tdsForCredit(input: {
  settings: AffiliateSettings['tds']
  /** Commission approved earlier in the same financial year. */
  yearCreditedPaise: number
  /** TDS already deducted on it. */
  yearTdsPaise: number
  creditPaise: number
  hasPan: boolean
}): number {
  const { settings: s } = input
  if (!s.enabled || input.creditPaise <= 0) return 0
  const total = input.yearCreditedPaise + input.creditPaise
  if (total <= s.thresholdPaise) return 0
  const bp = input.hasPan ? s.bp : s.noPanBp
  const due = Math.round((total * bp) / 10_000) - input.yearTdsPaise
  return Math.max(0, Math.min(due, input.creditPaise))
}

/** 1 April (IST) of the Indian financial year `at` falls in. */
export function financialYearStart(at: Date): Date {
  const wall = wallClock(at)
  const year = wall.getUTCMonth() >= 3 ? wall.getUTCFullYear() : wall.getUTCFullYear() - 1
  return dayStart(`${year}-04-01`)
}
