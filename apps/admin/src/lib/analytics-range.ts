/**
 * Server-side twin of the analytics range parsers, so `page.tsx` can run the
 * first query on the server and hand the client a filled page.
 */
import { formatPercent } from '@commerce/money'
import type { SearchParams } from './list-query'

export type RangeKey = 'today' | '7d' | '30d' | '90d' | 'custom'

export type RangeState = {
  key: RangeKey
  /** ISO dates, only read when `key` is `custom`. */
  from?: string | undefined
  to?: string | undefined
}

export const DEFAULT_RANGE: RangeState = { key: '30d' }

const KEYS: readonly RangeKey[] = ['today', '7d', '30d', '90d', 'custom']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

/** Reads `?range=` (and `?from=`/`?to=` for a custom span) into a range the router accepts. */
export function parseRange(sp: SearchParams): RangeState {
  const key = first(sp.range)
  if (!key || !(KEYS as readonly string[]).includes(key)) return DEFAULT_RANGE
  if (key !== 'custom') return { key: key as RangeKey }
  const from = first(sp.from)
  const to = first(sp.to)
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) return DEFAULT_RANGE
  return from <= to ? { key: 'custom', from, to } : { key: 'custom', from: to, to: from }
}

/** Query string for a range, empty for the default so clean URLs stay clean. */
export function rangeQuery(range: RangeState): string {
  if (range.key === DEFAULT_RANGE.key) return ''
  if (range.key !== 'custom') return `?range=${range.key}`
  return `?range=custom&from=${range.from}&to=${range.to}`
}

export function sameRange(a: RangeState, b: RangeState): boolean {
  return a.key === b.key && a.from === b.from && a.to === b.to
}

/** "12 Sept" for chart and table labels; ISO dates come from the service. */
const shortDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

export function formatDay(iso: string): string {
  return shortDate.format(new Date(`${iso}T00:00:00`))
}

export function formatRate(value: number): string {
  return formatPercent(value, { maximumFractionDigits: 1 })
}
