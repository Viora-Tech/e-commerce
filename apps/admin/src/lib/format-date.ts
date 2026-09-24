const DAY_MS = 86_400_000

const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
const dayMonth = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
const dayMonthYear = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const full = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Whole days between two dates, ignoring the time of day. */
function daysApart(value: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(value)) / DAY_MS)
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
  const day = date.getFullYear() === now.getFullYear() ? dayMonth : dayMonthYear
  return day.format(date)
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

/** Sort key that groups everything placed on the same calendar day. */
export function dayKey(value: Date | string): string {
  const d = new Date(value)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
