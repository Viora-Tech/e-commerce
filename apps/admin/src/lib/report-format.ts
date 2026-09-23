/**
 * Turns report values into display text and CSV cells by column kind. The API
 * sends raw values (paise, fractions, state codes, method ids) so the same
 * numbers can be formatted, compared and exported.
 */
import type { ReportColumnKind, ReportValue } from '@commerce/api'
import { methodLabel } from '@/components/orders/order-detail-types'
import { analyticsContent } from '@/data/analytics'
import { INDIAN_STATES } from '@/data/india'
import { formatDay, formatRate } from './analytics-range'
import { formatPaise, formatPaiseCompact } from './money'

const copy = analyticsContent.reports
const STATE_NAMES = new Map(INDIAN_STATES.map((s) => [s.code, s.name]))
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/

const count = new Intl.NumberFormat('en-IN')
const decimal = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })
const monthName = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' })

export const NUMERIC_KINDS: ReadonlySet<ReportColumnKind> = new Set([
  'count',
  'money',
  'percent',
  'decimal',
  'hours',
  'days',
])

export function isNumericKind(kind: ReportColumnKind): boolean {
  return NUMERIC_KINDS.has(kind)
}

/** Text for words-like values: states, methods, fixed keys, dates. */
function formatWord(kind: ReportColumnKind, value: string): string {
  if (kind === 'state') return STATE_NAMES.get(value) ?? value
  if (kind === 'payment') return methodLabel(value)
  if (kind === 'label') return copy.labels[value] ?? value
  if (kind === 'date' && ISO_DATE.test(value)) return formatDay(value)
  if (kind === 'month' && ISO_MONTH.test(value)) {
    return monthName.format(new Date(`${value}-01T00:00:00`))
  }
  return value
}

/** One table cell. Missing values read as "Not set" in label columns and "-" in numbers. */
export function formatCell(kind: ReportColumnKind, value: ReportValue | undefined): string {
  if (value === null || value === undefined || value === '') {
    return isNumericKind(kind) ? '-' : copy.notSet
  }
  if (typeof value === 'string') return formatWord(kind, value)
  if (kind === 'money') return formatPaise(value)
  if (kind === 'percent') return formatRate(value)
  if (kind === 'decimal') return decimal.format(value)
  if (kind === 'hours') return copy.hours(decimal.format(value))
  if (kind === 'days') return copy.days(decimal.format(value))
  return count.format(value)
}

/** Short form for chart axes. */
export function formatAxis(kind: ReportColumnKind, value: number): string {
  if (kind === 'money') return formatPaiseCompact(value)
  if (kind === 'percent') return formatRate(value)
  return decimal.format(value)
}

/** A CSV cell: rupees with paise, percentages as numbers, words as shown on screen. */
export function csvCell(kind: ReportColumnKind, value: ReportValue | undefined): string | number {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string')
    return kind === 'date' || kind === 'month' ? value : formatWord(kind, value)
  if (kind === 'money') return (value / 100).toFixed(2)
  if (kind === 'percent') return (value * 100).toFixed(2)
  if (kind === 'count') return value
  return Number(value.toFixed(2))
}

/** Metrics where a rise is bad news, so the change chip reads red going up. */
export const LOWER_IS_BETTER: ReadonlySet<string> = new Set([
  'cancelled',
  'discounts',
  'returns',
  'rto',
  'rtoRate',
  'dispatchHours',
  'deliveryDays',
  'refunds',
  'refunded',
  'returned',
  'returnRate',
])

/** Percent change against the previous period, null when there is nothing to compare. */
export function change(
  value: ReportValue | undefined,
  previous: ReportValue | undefined,
): number | null {
  if (typeof value !== 'number' || typeof previous !== 'number') return null
  if (previous === 0) return value === 0 ? 0 : null
  return ((value - previous) / Math.abs(previous)) * 100
}
