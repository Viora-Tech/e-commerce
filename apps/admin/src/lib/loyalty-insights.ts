/**
 * Loyalty points admin insights, pure helpers: the analytics date range as instants (store
 * day, IST), the revenue chart's days filled with zeros, average order value, a quick look at
 * an import file before it is sent, and the members list's sort as the API's.
 */
import { IST_OFFSET_MS } from '@commerce/dates'
import { addDays } from '@/lib/home-range'

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` store days (both counted) as the API's `[from, to)` instants. */
export function rangeInstants(range: { from: string; to: string }): { from: Date; to: Date } {
  const midnight = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - IST_OFFSET_MS)
  return { from: midnight(range.from), to: midnight(addDays(range.to, 1)) }
}

/** Every day from `from` to `to` (both counted) with its value, 0 where the API had no row. */
export function fillDays<T extends { day: string }>(
  range: { from: string; to: string },
  rows: readonly T[],
  value: (row: T) => number,
): { day: string; value: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, value(r)]))
  const out: { day: string; value: number }[] = []
  const last = Date.parse(`${range.to}T00:00:00Z`)
  for (let t = Date.parse(`${range.from}T00:00:00Z`); t <= last; t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10)
    out.push({ day, value: byDay.get(day) ?? 0 })
  }
  return out
}

/** Average order value in paise, or null with no orders. */
export function aovPaise(revenuePaise: number, orders: number): number | null {
  return orders > 0 ? Math.round(revenuePaise / orders) : null
}

export type CsvPeek = { ok: boolean; rows: number; missing: ('email' | 'points')[] }

/** A first look at an import file in the browser: has it the two columns, and how many rows. */
export function peekPointsCsv(text: string): CsvPeek {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
  const head = (lines[0] ?? '').split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''))
  const missing = (['email', 'points'] as const).filter((c) => !head.includes(c))
  return { ok: missing.length === 0, rows: Math.max(0, lines.length - 1), missing }
}

/** The members table's sortable columns, as the API's `sort`. */
export const MEMBER_SORTS = {
  name: 'name',
  lifetime: 'lifetime_points',
  spent: 'total_spent',
  joined: 'joined',
} as const
export type MemberSortColumn = keyof typeof MEMBER_SORTS

/** `lifetime.desc` (the URL's `sort`) as a table sort; null for anything else (the default). */
export function parseMemberSort(raw: string): { id: MemberSortColumn; desc: boolean } | null {
  const [id, dir] = raw.split('.')
  if (!id || !(id in MEMBER_SORTS) || (dir !== 'asc' && dir !== 'desc')) return null
  return { id: id as MemberSortColumn, desc: dir === 'desc' }
}

/** A table sort as the URL value, '' for none. */
export function memberSortParam(sort: { id: string; desc: boolean } | null): string {
  if (!sort || !(sort.id in MEMBER_SORTS)) return ''
  return `${sort.id}.${sort.desc ? 'desc' : 'asc'}`
}

/** The API's sort and direction for the URL value (newest members first by default). */
export function memberSortInput(raw: string): {
  sort: (typeof MEMBER_SORTS)[MemberSortColumn]
  dir: 'asc' | 'desc'
} {
  const s = parseMemberSort(raw)
  if (!s) return { sort: 'joined', dir: 'desc' }
  return { sort: MEMBER_SORTS[s.id], dir: s.desc ? 'desc' : 'asc' }
}

/** A file name for the members export, dated in the store's day. */
export function exportFileName(now: Date = new Date()): string {
  const day = new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
  return `loyalty-members-${day}.csv`
}
