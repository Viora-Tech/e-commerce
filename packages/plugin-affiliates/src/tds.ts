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

/** A TDS return quarter: financial year by its starting year (2026 = FY 2026-27) and 1 to 4. */
export type TdsQuarter = { fy: number; quarter: 1 | 2 | 3 | 4 }

const QUARTER_MONTHS = ['04', '07', '10', '01'] as const

/**
 * The IST instants a 26Q quarter runs from (inclusive) to (exclusive): Q1 April to June, Q2
 * July to September, Q3 October to December, Q4 January to March of the next calendar year.
 */
export function quarterRange({ fy, quarter }: TdsQuarter): { from: Date; to: Date } {
  const startYear = quarter === 4 ? fy + 1 : fy
  const from = dayStart(`${startYear}-${QUARTER_MONTHS[quarter - 1]}-01`)
  const to =
    quarter === 4
      ? dayStart(`${fy + 1}-04-01`)
      : dayStart(`${quarter === 3 ? fy + 1 : fy}-${QUARTER_MONTHS[quarter]}-01`)
  return { from, to }
}

/** The quarter an instant falls in (IST). */
export function quarterOf(at: Date): TdsQuarter {
  const wall = wallClock(at)
  const month = wall.getUTCMonth()
  const fy = month >= 3 ? wall.getUTCFullYear() : wall.getUTCFullYear() - 1
  const quarter = month >= 3 ? Math.floor((month - 3) / 3) + 1 : 4
  return { fy, quarter: quarter as TdsQuarter['quarter'] }
}
