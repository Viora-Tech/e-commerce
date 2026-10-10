/**
 * SOURCE OF TRUTH KEYWORDS: admin region, time format, 12-hour, 24-hour, week start
 * WHAT:  The member's date-and-time preferences (Account → Language & region): 12- or 24-hour
 *        times and the first day of the week. Stored in the `admin_region` cookie like the
 *        admin language, read by the root layout and handed to `useFormat()`.
 * WHY:   One parser for the server (root layout) and the client (the settings page), so an
 *        unknown or tampered cookie always falls back to the defaults.
 * WHERE: app/layout.tsx, components/layout/locale-provider.tsx, hooks/use-copy.ts, lib/format.ts.
 */

export const CLOCKS = ['12h', '24h'] as const
export type Clock = (typeof CLOCKS)[number]

export const WEEK_STARTS = ['mon', 'sun'] as const
export type WeekStart = (typeof WEEK_STARTS)[number]

export type Region = { clock: Clock; weekStart: WeekStart }

/** India's habit: 12-hour times, weeks from Monday. */
export const DEFAULT_REGION: Region = { clock: '12h', weekStart: 'mon' }

export const REGION_COOKIE = 'admin_region'
const REGION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** `12h.mon` → the region; anything unknown keeps the default for that part. */
export function parseRegion(value: string | null | undefined): Region {
  const [clock, weekStart] = (value ?? '').split('.')
  return {
    clock: (CLOCKS as readonly string[]).includes(clock ?? '')
      ? (clock as Clock)
      : DEFAULT_REGION.clock,
    weekStart: (WEEK_STARTS as readonly string[]).includes(weekStart ?? '')
      ? (weekStart as WeekStart)
      : DEFAULT_REGION.weekStart,
  }
}

/** The cookie value for `region`, e.g. `24h.sun`. */
export function regionValue(region: Region): string {
  return `${region.clock}.${region.weekStart}`
}

/** The `Set-Cookie`-style string that stores `region` for a year on every admin path. */
export function regionCookie(region: Region): string {
  return `${REGION_COOKIE}=${regionValue(region)}; path=/; max-age=${REGION_COOKIE_MAX_AGE}; samesite=lax`
}

/** `react-day-picker`'s `weekStartsOn`: 0 is Sunday, 1 is Monday. */
export function weekStartsOn(region: Region): 0 | 1 {
  return region.weekStart === 'sun' ? 0 : 1
}

/**
 * Monday-first weekdays (ISO numbers, Sunday is 7 or 0) in the member's order: Sunday moves to
 * the front when their week starts on Sunday.
 */
export function orderWeekdays<T extends { value: number }>(
  days: readonly T[],
  region: Region,
): T[] {
  if (region.weekStart === 'mon') return [...days]
  const isSunday = (d: T) => d.value === 0 || d.value === 7
  return [...days.filter(isSunday), ...days.filter((d) => !isSunday(d))]
}
