/** SOURCE OF TRUTH: team report periods — WHAT: which days a daily summary, weekly or monthly report covers, the period before it, its bars and its history columns, with their labels / WHY: pure, so the date edges (a week across two months, the 1st, IST midnight) are tested without a database */
import { dayKey, formatInZone, startOfDay, startOfMonth, wallClock } from '@commerce/dates'

export type ReportKind = 'daily' | 'weekly' | 'monthly'

export type Span = { from: Date; to: Date }

export type ReportPeriod = Span & {
  kind: ReportKind
  /** The period before, for every change figure. */
  previous: Span
  /** What `lastSentOn` records so a period never sends twice: a day, a week's Monday, `YYYY-MM`. */
  key: string
  /** The daily summary sent after noon covers today so far, else all of yesterday. */
  today: boolean
  /** The bar chart's columns, in order. */
  buckets: (Span & {
    label: string
    /** In the note under the bars: "Saturday", "13–19 October", or a slot's edges in words. */
    name: string
    words?: [string, string]
  })[]
  /** Earlier periods as columns, oldest first; the last is this period. */
  history: (Span & { label: string })[]
  labels: {
    /** "Monday 10 – Sunday 16 November". */
    period: string
    /** The kicker's detail: the weekday, ISO week number or "October 2026". */
    kicker: string
    /** "Tuesday", "October": for the title and the change note. */
    name: string
    /** The period before by name: "Tuesday", "September". */
    previousName: string
    /** Short form for "vs last Tue". */
    previousShort: string
  }
}

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
// en-US: its short months are "Sep", not en-GB's "Sept"; every label is built from single parts.
const EN = { locale: 'en-US' }

const fmt = (at: Date, options: Intl.DateTimeFormatOptions) => formatInZone(at, options, EN)
const weekday = (at: Date) => fmt(at, { weekday: 'long' })
const weekdayShort = (at: Date) => fmt(at, { weekday: 'short' })
const monthName = (at: Date) => fmt(at, { month: 'long' })
const dayNum = (at: Date) => fmt(at, { day: 'numeric' })
const shift = (s: Span, ms: number): Span => ({
  from: new Date(s.from.getTime() + ms),
  to: new Date(s.to.getTime() + ms),
})

/** "Monday 10 – Sunday 16 November", naming the first month too when the span crosses one. */
function spanLabel(from: Date, lastDay: Date): string {
  const sameMonth = monthName(from) === monthName(lastDay)
  const start = `${weekday(from)} ${dayNum(from)}${sameMonth ? '' : ` ${monthName(from)}`}`
  return `${start} – ${weekday(lastDay)} ${dayNum(lastDay)} ${monthName(lastDay)}`
}

/** ISO 8601 week number of the IST day `at` falls on. */
export function isoWeek(at: Date): number {
  const wall = wallClock(at)
  const d = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7)
}

/** IST weekday of `at`, Monday 0 … Sunday 6. */
const mondayIndex = (at: Date) => (wallClock(at).getUTCDay() + 6) % 7

/** The daily summary's slots (Figma "Daily summary · final"): hours of the IST day, in words. */
const DAILY_SLOTS: [number, number, string, string, string][] = [
  [0, 6, '12–6am', 'midnight', '6 am'],
  [6, 10, '6–10am', '6', '10 am'],
  [10, 14, '10am–2pm', '10 am', '2 pm'],
  [14, 18, '2–6pm', '2', '6 pm'],
  [18, 22, '6–10pm', '6', '10 pm'],
  [22, 24, '10pm–12', '10 pm', 'midnight'],
]

/** Yesterday (or today so far, after noon), against the same hours a week before. */
export function dailyPeriod(now: Date): ReportPeriod {
  const today = wallClock(now).getUTCHours() >= 12
  const from = startOfDay(now, undefined, today ? 0 : -1)
  const to = today ? now : startOfDay(now)
  return {
    kind: 'daily',
    from,
    to,
    previous: shift({ from, to }, -7 * DAY_MS),
    key: dayKey(now),
    today,
    buckets: DAILY_SLOTS.map(([a, b, label, w1, w2]) => ({
      from: new Date(from.getTime() + a * HOUR_MS),
      to: new Date(from.getTime() + b * HOUR_MS),
      label,
      name: label,
      words: [w1, w2] as [string, string],
    })),
    history: Array.from({ length: 7 }, (_, i) => {
      const day = {
        from: new Date(from.getTime() - (6 - i) * DAY_MS),
        to: new Date(from.getTime() - (5 - i) * DAY_MS),
      }
      return { ...day, ...(i === 6 ? { to } : {}), label: weekdayShort(day.from) }
    }),
    labels: {
      period: `${weekday(from)} ${dayNum(from)} ${monthName(from)}`,
      kicker: weekday(from),
      name: weekday(from),
      previousName: weekday(from),
      previousShort: weekdayShort(from),
    },
  }
}

/** The last whole Monday–Sunday week before `now`, against the week before it. */
export function weeklyPeriod(now: Date): ReportPeriod {
  const to = startOfDay(now, undefined, -mondayIndex(now))
  const from = new Date(to.getTime() - 7 * DAY_MS)
  return {
    kind: 'weekly',
    from,
    to,
    previous: shift({ from, to }, -7 * DAY_MS),
    key: dayKey(from),
    today: false,
    buckets: Array.from({ length: 7 }, (_, i) => {
      const day = shift({ from, to: new Date(from.getTime() + DAY_MS) }, i * DAY_MS)
      return { ...day, label: weekdayShort(day.from), name: weekday(day.from) }
    }),
    history: Array.from({ length: 5 }, (_, i) => {
      const week = shift({ from, to }, -(4 - i) * 7 * DAY_MS)
      return { ...week, label: `${dayNum(week.from)} ${fmt(week.from, { month: 'short' })}` }
    }),
    labels: {
      period: spanLabel(from, new Date(to.getTime() - DAY_MS)),
      kicker: String(isoWeek(from)),
      name: '',
      previousName: '',
      previousShort: '',
    },
  }
}

/** The last whole calendar month before `now`, its weeks cut at the month's edges. */
export function monthlyPeriod(now: Date): ReportPeriod {
  const from = startOfMonth(now, undefined, -1)
  const to = startOfMonth(now)
  const prevFrom = startOfMonth(now, undefined, -2)
  const buckets: ReportPeriod['buckets'] = []
  for (let start = from; start < to; ) {
    const nextMonday = startOfDay(start, undefined, 7 - mondayIndex(start))
    const end = nextMonday < to ? nextMonday : to
    const last = new Date(end.getTime() - DAY_MS)
    const days =
      start.getTime() === last.getTime() ? dayNum(start) : `${dayNum(start)}–${dayNum(last)}`
    buckets.push({
      from: start,
      to: end,
      label: buckets.length ? days : `${days} ${fmt(from, { month: 'short' })}`,
      name: `${days} ${monthName(from)}`,
    })
    start = end
  }
  return {
    kind: 'monthly',
    from,
    to,
    previous: { from: prevFrom, to: from },
    key: dayKey(from).slice(0, 7),
    today: false,
    buckets,
    history: Array.from({ length: 6 }, (_, i) => {
      const m = {
        from: startOfMonth(now, undefined, i - 6),
        to: startOfMonth(now, undefined, i - 5),
      }
      return { ...m, label: i === 5 ? monthName(m.from) : fmt(m.from, { month: 'short' }) }
    }),
    labels: {
      period: spanLabel(from, new Date(to.getTime() - DAY_MS)),
      kicker: fmt(from, { month: 'long', year: 'numeric' }),
      name: monthName(from),
      previousName: monthName(prevFrom),
      previousShort: monthName(prevFrom),
    },
  }
}

export function reportPeriod(kind: ReportKind, now: Date): ReportPeriod {
  if (kind === 'daily') return dailyPeriod(now)
  return kind === 'weekly' ? weeklyPeriod(now) : monthlyPeriod(now)
}

/** Whether a weekly or monthly report is due: Monday (or the 1st) from 9:00 IST, all that day. */
export function reportDue(kind: 'weekly' | 'monthly', now: Date): boolean {
  const wall = wallClock(now)
  if (wall.getUTCHours() < 9) return false
  return kind === 'weekly' ? wall.getUTCDay() === 1 : wall.getUTCDate() === 1
}
