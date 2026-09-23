import type { StoreTx } from '@commerce/db'
import { order } from '@commerce/db'
import { and, gte, lt, ne } from 'drizzle-orm'

export type ReportValue = string | number | null

export type ReportRow = {
  /** Stable across periods, so a row can be matched to its previous-period twin. */
  key: string
  values: Record<string, ReportValue>
  /** The report metric for the same key in the previous period; null when absent. */
  previous?: number | null
}

/** What one report builder returns for one span of days. */
export type ReportData = {
  rows: ReportRow[]
  totals: Record<string, ReportValue>
  /** Daily chart for reports whose rows are not days; `series` reports draw their rows. */
  series?: { label: string; value: number }[]
}

/** A span of IST days: `from` is midnight of the first, `to` midnight after the last. */
export type ReportSpan = {
  from: Date
  to: Date
  days: string[]
  /** Clock used for snapshots such as "stock on hand now". */
  now: Date
}

export type ReportBuilder = (tx: StoreTx, span: ReportSpan) => Promise<ReportData>

/** Drafts never count; cancelled orders count only where a report says so. */
export const notDraft = ne(order.status, 'draft')
export const counted = and(notDraft, ne(order.status, 'cancelled'))

export const placedIn = (span: ReportSpan) =>
  and(gte(order.placedAt, span.from), lt(order.placedAt, span.to))

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null
}

export function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((n, v) => n + v, 0) / values.length : null
}

export function sumOf<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((n, r) => n + pick(r), 0)
}

/** Payment methods that collect cash at the door; everything else is paid before dispatch. */
export function paymentType(method: string | null): 'cod' | 'prepaid' | 'unknown' {
  if (!method) return 'unknown'
  return method === 'cod' ? 'cod' : 'prepaid'
}

/** Buckets items by a string key, keeping first-seen order. */
export function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const list = out.get(key)
    if (list) list.push(item)
    else out.set(key, [item])
  }
  return out
}

/** Sorts rows by a numeric column, largest first. */
export function byDesc(column: string) {
  return (a: ReportRow, b: ReportRow) =>
    Number(b.values[column] ?? 0) - Number(a.values[column] ?? 0)
}

/** Adds each row's share of the whole under `share`. */
export function withShare(rows: ReportRow[], column: string, total: number): ReportRow[] {
  return rows.map((r) => ({
    ...r,
    values: { ...r.values, share: ratio(Number(r.values[column] ?? 0), total) },
  }))
}
