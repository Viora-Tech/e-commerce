import type { Formatters } from '@/lib/format'

/** "Thu 16 Oct, 14:00" for a booked pickup's day ("YYYY-MM-DD", India) and start time. */
export function pickupWhen(format: Formatters, date: string, timeFrom: string): string {
  // Noon in India keeps the calendar day whatever zone the browser is in.
  const day = format.pattern(`${date}T12:00:00+05:30`, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return `${day}, ${timeFrom}`
}
