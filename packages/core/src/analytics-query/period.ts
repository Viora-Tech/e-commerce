/** SOURCE OF TRUTH: custom analytics query dates — WHAT: SINCE / UNTIL / DURING turned into IST calendar days, and the range checks / WHY: the editor, the parser and the server read a range the same way and never cut one short */
import { dayKey } from '@commerce/dates'
import { QUERY_RANGE_MAX_YEARS, type QueryPeriod, type TIME_WORDS } from './schema'

/** `-30d` (days), `-4w` (weeks), `-3m` (months), `-2y` (years), a word, or an ISO date. */
export type QueryTime =
  | { kind: 'relative'; amount: number; unit: 'd' | 'w' | 'm' | 'y' }
  | { kind: 'word'; word: (typeof TIME_WORDS)[number] }
  | { kind: 'date'; iso: string }

/** The days a query covers, both included, `YYYY-MM-DD` in IST. */
export type QueryDays = { from: string; to: string }

const DAY_MS = 86_400_000

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)

export function addDays(day: string, n: number): string {
  return iso(new Date(utc(day).getTime() + n * DAY_MS))
}

/** First day of the month `n` months from `day`'s month. */
function monthStart(day: string, n = 0): string {
  const d = utc(day)
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)))
}

/** Days from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / DAY_MS) + 1
}

/** The IST calendar day a SINCE / UNTIL value points at. */
export function timeDay(t: QueryTime, now: Date = new Date()): string {
  if (t.kind === 'date') return t.iso
  if (t.kind === 'word')
    return dayKey(new Date(now.getTime() - (t.word === 'yesterday' ? DAY_MS : 0)))
  const d = new Date(now)
  if (t.unit === 'm') d.setUTCMonth(d.getUTCMonth() - t.amount)
  else if (t.unit === 'y') d.setUTCFullYear(d.getUTCFullYear() - t.amount)
  else d.setTime(d.getTime() - t.amount * (t.unit === 'w' ? 7 : 1) * DAY_MS)
  return dayKey(d)
}

/**
 * A DURING period's days. Weeks start on Monday, quarters are Jan–Mar and so on, financial
 * years run April to March. `this_…` periods end today; `all_time` starts on `firstDay` (the
 * store's first order, which only the server knows; the widest allowed range without it).
 */
export function periodDays(period: QueryPeriod, now: Date, firstDay?: string | null): QueryDays {
  const today = dayKey(now)
  const [y, m] = today.split('-').map(Number) as [number, number]
  const weekday = (utc(today).getUTCDay() + 6) % 7
  const quarter = monthStart(`${y}-${String(m - ((m - 1) % 3)).padStart(2, '0')}-01`)
  const fyStart = `${m >= 4 ? y : y - 1}-04-01`
  switch (period) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case 'this_week':
      return { from: addDays(today, -weekday), to: today }
    case 'last_week':
      return { from: addDays(today, -weekday - 7), to: addDays(today, -weekday - 1) }
    case 'this_month':
      return { from: monthStart(today), to: today }
    case 'last_month':
      return { from: monthStart(today, -1), to: addDays(monthStart(today), -1) }
    case 'this_quarter':
      return { from: quarter, to: today }
    case 'last_quarter':
      return { from: monthStart(quarter, -3), to: addDays(quarter, -1) }
    case 'this_year':
      return { from: `${y}-01-01`, to: today }
    case 'last_year':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    case 'this_financial_year':
      return { from: fyStart, to: today }
    case 'last_financial_year':
      return { from: monthStart(fyStart, -12), to: addDays(fyStart, -1) }
    case 'all_time': {
      const widest = addDays(
        timeDay({ kind: 'relative', amount: QUERY_RANGE_MAX_YEARS, unit: 'y' }, now),
        1,
      )
      if (!firstDay) return { from: widest, to: today }
      return { from: firstDay < today ? firstDay : today, to: today }
    }
  }
}

/** The days a query covers: DURING when it has one, else SINCE / UNTIL. */
export function queryDays(
  q: { since: QueryTime; until: QueryTime; during: QueryPeriod | null },
  now: Date = new Date(),
  firstDay?: string | null,
): QueryDays {
  if (q.during) return periodDays(q.during, now, firstDay)
  return { from: timeDay(q.since, now), to: timeDay(q.until, now) }
}

/** Why a range cannot run (it is never shortened instead), or null when it can. */
export function rangeProblem(days: QueryDays): string | null {
  if (days.from > days.to) {
    return `SINCE ${days.from} is after UNTIL ${days.to}. Swap them.`
  }
  // 366 a year, so SINCE -20y always fits whatever leap days it crosses.
  if (daysBetween(days.from, days.to) > 366 * QUERY_RANGE_MAX_YEARS) {
    return `A query covers at most ${QUERY_RANGE_MAX_YEARS} years; ${days.from} to ${days.to} is longer. Use DURING all_time for the store's whole history.`
  }
  return null
}
