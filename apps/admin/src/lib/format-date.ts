const DAY_MS = 86_400_000
/**
 * Every formatter here is pinned to Asia/Kolkata (the store's own timezone, per
 * docs/guardrails.md multi-currency notes — this platform is India-only today). Without an
 * explicit zone, `Intl.DateTimeFormat` falls back to the runtime's own default, which can
 * differ between the Next.js server process and the browser (e.g. a server on UTC, a browser
 * on IST) and produce a server/client text mismatch — a React hydration error.
 */
const TIME_ZONE = 'Asia/Kolkata'
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

const time = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: TIME_ZONE,
})
const dayMonth = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: TIME_ZONE,
})
const dayMonthYear = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
})
const full = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: TIME_ZONE,
})
const medium = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: TIME_ZONE })

/** The date shifted so its UTC getters read as IST wall-clock time. */
function toIst(d: Date): Date {
  return new Date(d.getTime() + IST_OFFSET_MS)
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
export function formatWhen(value: Date | string, now = new Date()): string {
  const date = new Date(value)
  const days = daysApart(date, now)
  const at = time.format(date).toLowerCase()
  if (days === 0) return `Today, ${at}`
  if (days === 1) return `Yesterday, ${at}`
  if (days > 1 && days <= DAYS_AGO_LIMIT) return `${days} days ago`
  const day = istYear(date) === istYear(now) ? dayMonth : dayMonthYear
  return day.format(date)
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago". */
export function formatAgo(value: Date | string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

/** Day heading for grouped lists: "Today", "Yesterday", "3 Sept 2026". */
export function formatDay(value: Date | string, now = new Date()): string {
  const date = new Date(value)
  const days = daysApart(date, now)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return dayMonthYear.format(date)
}

/** Date and time in one line, for tables and print. */
export function formatDateTime(value: Date | string): string {
  return full.format(new Date(value))
}

/** Date only, no time: "12 Sept 2026". */
export function formatDate(value: Date | string): string {
  return medium.format(new Date(value))
}

/** Sort key that groups everything placed on the same IST calendar day. */
export function dayKey(value: Date | string): string {
  const ist = toIst(new Date(value))
  return `${ist.getUTCFullYear()}-${ist.getUTCMonth() + 1}-${ist.getUTCDate()}`
}
