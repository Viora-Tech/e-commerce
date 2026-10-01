/**
 * SOURCE OF TRUTH KEYWORDS: @commerce/dates, DEFAULT_TIME_ZONE, IST_OFFSET_MS, formatInZone,
 *   dayKey, startOfDay, startOfMonth, dayStart, wallClock, zoneOffsetMs, msUntil, formatCountdown
 * WHAT:  Store-timezone date maths (day/month boundaries, day keys) and the one cached
 *        `Intl.DateTimeFormat` every date label goes through.
 * WHY:   The IST offset was hand-written in seven places and ~13 admin screens built their own
 *        `Intl.DateTimeFormat` without a zone, so server (UTC) and browser (IST) could disagree
 *        on the day and on the text (a hydration error). Every helper takes the store's
 *        `timeZone` (store.timezone, default Asia/Kolkata) so a non-India store is one argument
 *        away. Pure and dependency-free, so client components may import it.
 * WHERE: Admin `lib/format-date.ts` (`useFormat()`), API analytics/dashboard buckets, queue
 *        visitor counters; guarded by the date-format sweep.
 */

/** The platform's default store timezone (`store.timezone` defaults to this). */
export const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

/** UTC+05:30. India has no daylight saving, so this is exact for every instant. */
export const IST_OFFSET_MS = 330 * 60_000

const DAY_MS = 86_400_000

export type ZoneOptions = {
  /** BCP 47 locale. Default `en-IN`. */
  locale?: string
  /** IANA zone. Default `DEFAULT_TIME_ZONE`. */
  timeZone?: string
}

const formatCache = new Map<string, Intl.DateTimeFormat>()

function formatter(options: Intl.DateTimeFormatOptions, zone: ZoneOptions): Intl.DateTimeFormat {
  const locale = zone.locale ?? 'en-IN'
  const timeZone = zone.timeZone ?? DEFAULT_TIME_ZONE
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`
  let f = formatCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone })
    formatCache.set(key, f)
  }
  return f
}

/** A date label in the store's zone: the one place the repo builds an `Intl.DateTimeFormat`. */
export function formatInZone(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions,
  zone: ZoneOptions = {},
): string {
  return formatter(options, zone).format(new Date(value))
}

/** Milliseconds to add to UTC to read the wall clock in `timeZone` at `at`. */
export function zoneOffsetMs(at: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  if (timeZone === DEFAULT_TIME_ZONE) return IST_OFFSET_MS
  const parts = formatter(
    {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    },
    { locale: 'en-US', timeZone },
  ).formatToParts(at)
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** `at` shifted so its UTC getters (getUTCDate, getUTCHours...) read the zone's wall clock. */
export function wallClock(at: Date, timeZone: string = DEFAULT_TIME_ZONE): Date {
  return new Date(at.getTime() + zoneOffsetMs(at, timeZone))
}

/** The zone's calendar day of `at` as `YYYY-MM-DD`. */
export function dayKey(at: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return wallClock(at, timeZone).toISOString().slice(0, 10)
}

/** The instant the zone's calendar day `YYYY-MM-DD` starts. */
export function dayStart(day: string, timeZone: string = DEFAULT_TIME_ZONE): Date {
  const utcMidnight = new Date(`${day}T00:00:00.000Z`)
  return new Date(utcMidnight.getTime() - zoneOffsetMs(utcMidnight, timeZone))
}

/** The instant the zone's calendar day containing `at` started, `days` days later. */
export function startOfDay(at: Date, timeZone: string = DEFAULT_TIME_ZONE, days = 0): Date {
  const wall = wallClock(at, timeZone)
  const midnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate())
  return new Date(midnight + days * DAY_MS - zoneOffsetMs(at, timeZone))
}

/** The instant the zone's calendar month containing `at` started, `months` months later. */
export function startOfMonth(at: Date, timeZone: string = DEFAULT_TIME_ZONE, months = 0): Date {
  const wall = wallClock(at, timeZone)
  const first = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth() + months, 1)
  return new Date(first - zoneOffsetMs(at, timeZone))
}

/**
 * Milliseconds until `at` (an instant or ISO string), 0 once it has passed or when unset.
 * The pre-order launch countdown in core (`msUntilLaunch`) and in the storefront blocks both
 * read this: blocks cannot import core (core depends on blocks), so the maths lives here.
 */
export function msUntil(at: Date | string | null | undefined, now: Date = new Date()): number {
  if (!at) return 0
  return Math.max(0, new Date(at).getTime() - now.getTime())
}

/** A countdown as the storefront shows it: "2d 5h", "5h 20m", "20m". */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
