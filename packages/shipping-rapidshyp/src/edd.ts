import { dayKey } from '@commerce/dates'

const DAY_MS = 24 * 60 * 60 * 1000

/** A calendar date as UTC midnight, or null when the parts are not a real date (31-02). */
function calendarDate(y: number, m: number, d: number): number | null {
  const t = Date.UTC(y, m - 1, d)
  const back = new Date(t)
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d
    ? t
    : null
}

/**
 * Days from today (India's calendar) to RapidShyp's estimated delivery date (`edd`), or null.
 * RapidShyp's serviceability docs show `edd` as DD-MM-YYYY ("22-04-2026"); YYYY-MM-DD and a
 * trailing time are read too. Before this, only YYYY-MM-DD parsed, so every RapidShyp route
 * fell back to the store's default transit days and showed the same date.
 */
export function eddDaysFromToday(
  dateStr: string | undefined,
  now: number = Date.now(),
): number | null {
  const s = dateStr?.trim() ?? ''
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/.exec(s)
  const ymd = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(s)
  const target = dmy
    ? calendarDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]))
    : ymd
      ? calendarDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))
      : null
  if (target === null) return null
  const today = Date.parse(`${dayKey(new Date(now))}T00:00:00Z`)
  const days = Math.round((target - today) / DAY_MS)
  return days > 0 ? days : null
}
