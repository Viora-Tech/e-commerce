import { DEFAULT_TIME_ZONE, formatInZone, wallClock, dayKey as zoneDayKey } from '@commerce/dates'
import { datesContent } from '@/data/dates'
import { localize } from '@/lib/copy'
import { INTL_LOCALE, type Locale } from '@/lib/i18n'

const DAY_MS = 86_400_000
/**
 * Every formatter here is pinned to the store's zone (`DEFAULT_TIME_ZONE`, Asia/Kolkata —
 * this platform is India-only today) through `formatInZone` in `@commerce/dates`. Without an
 * explicit zone, `Intl.DateTimeFormat` falls back to the runtime's own default, which can
 * differ between the Next.js server process and the browser (e.g. a server on UTC, a browser
 * on IST) and produce a server/client text mismatch — a React hydration error.
 */

/** Any `Intl` date pattern, in the member's language and the store's zone. */
export function formatPattern(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions,
  locale: Locale = 'en',
): string {
  return formatInZone(value, options, { locale: INTL_LOCALE[locale], timeZone: DEFAULT_TIME_ZONE })
}

/**
 * Hindi spells the month out ("12 सितंबर"): hi-IN's short months carry an abbreviation
 * mark ("सित॰") that reads worse than the full word.
 */
const monthStyle = (locale: Locale) => (locale === 'hi' ? 'long' : 'short')

function formats(locale: Locale) {
  const month = monthStyle(locale)
  const as = (options: Intl.DateTimeFormatOptions) => ({
    format: (d: Date) => formatPattern(d, options, locale),
  })
  return {
    time: as({ hour: 'numeric', minute: '2-digit', hour12: true }),
    dayMonth: as({ day: 'numeric', month }),
    dayMonthYear: as({ day: 'numeric', month, year: 'numeric' }),
    full: as({ dateStyle: 'medium', timeStyle: 'short' }),
    medium: as({ dateStyle: 'medium' }),
  }
}

/** The date shifted so its UTC getters read as IST wall-clock time. */
function toIst(d: Date): Date {
  return wallClock(d)
}

/** IST calendar day as a sortable/comparable number, independent of the runtime's own timezone. */
function istDayNumber(d: Date): number {
  const ist = toIst(d)
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate())
}

/** IST calendar year, independent of the runtime's own timezone. */
function istYear(d: Date): number {
  return toIst(d).getUTCFullYear()
}

/** Whole days between two dates, ignoring the time of day, in IST. */
function daysApart(value: Date, now: Date): number {
  return Math.round((istDayNumber(now) - istDayNumber(value)) / DAY_MS)
}

const DAYS_AGO_LIMIT = 6

/**
 * "Today, 9:15 pm", "Yesterday, 4:02 pm", "3 days ago", then "12 Sept" (the year joins once
 * it is not this year). Pair with `formatDateTime` as a title/tooltip for the exact moment.
 */
export function formatWhen(value: Date | string, now = new Date(), locale: Locale = 'en'): string {
  const date = new Date(value)
  const days = daysApart(date, now)
  const f = formats(locale)
  const copy = localize(datesContent, locale)
  const at = f.time.format(date).toLowerCase()
  if (days === 0) return copy.todayAt(at)
  if (days === 1) return copy.yesterdayAt(at)
  if (days > 1 && days <= DAYS_AGO_LIMIT) return copy.daysAgo(days)
  const day = istYear(date) === istYear(now) ? f.dayMonth : f.dayMonthYear
  return day.format(date)
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago". */
export function formatAgo(value: Date | string, now = new Date(), locale: Locale = 'en'): string {
  const copy = localize(datesContent, locale)
  const minutes = Math.floor((now.getTime() - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return copy.justNow
  if (minutes < 60) return copy.minutesAgo(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return copy.hoursAgo(hours)
  return copy.daysAgoShort(Math.floor(hours / 24))
}

/** Day heading for grouped lists: "Today", "Yesterday", "3 Sept 2026". */
export function formatDay(value: Date | string, now = new Date(), locale: Locale = 'en'): string {
  const date = new Date(value)
  const days = daysApart(date, now)
  const copy = localize(datesContent, locale)
  if (days === 0) return copy.today
  if (days === 1) return copy.yesterday
  return formats(locale).dayMonthYear.format(date)
}

/** Date and time in one line, for tables and print. */
export function formatDateTime(value: Date | string, locale: Locale = 'en'): string {
  return formats(locale).full.format(new Date(value))
}

/** Date only, no time: "12 Sept 2026". */
export function formatDate(value: Date | string, locale: Locale = 'en'): string {
  return formats(locale).medium.format(new Date(value))
}

/** "01-10-2026": the numeric day the list frames show (frame 5:2617). */
export function formatNumericDate(value: Date | string): string {
  return formatPattern(value, { day: '2-digit', month: '2-digit', year: 'numeric' }).replaceAll(
    '/',
    '-',
  )
}

/** Sort key that groups everything placed on the same IST calendar day. */
export function dayKey(value: Date | string): string {
  const ist = toIst(new Date(value))
  return `${ist.getUTCFullYear()}-${ist.getUTCMonth() + 1}-${ist.getUTCDate()}`
}

/** Today in the store's zone as `YYYY-MM-DD`, what a date field starts on. */
export function todayKey(now: Date = new Date()): string {
  return zoneDayKey(now)
}
