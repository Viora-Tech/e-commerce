/**
 * The subsolar point (where the sun sits directly overhead) for the globe's day/night shadow,
 * from the current UTC time alone. A low-precision approximation (NOAA's simplified formula
 * for declination, a plain hour angle for longitude) — plenty for a soft terminator band on a
 * small globe, not a navigation instrument.
 */

const DAY_MS = 86_400_000
const MS_PER_HOUR = 3_600_000
/** Earth's axial tilt, degrees. */
const OBLIQUITY_DEG = 23.44
/** The formula's reference day: the December solstice sits at day-of-year 355 (365.25/4 * 3 + 81 ≈), so declination is written as a sine that troughs there and peaks at day ~172 (June solstice). */
const REFERENCE_DAY = 81

export type SubsolarPoint = { lat: number; lng: number }

/** Day of the year (1 = Jan 1st, UTC), including the fractional part of the day. */
function fractionalDayOfYear(date: Date): number {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  return (date.getTime() - yearStart) / DAY_MS + 1
}

/**
 * Where the sun is directly overhead right now: latitude follows the seasons (±23.44°, zero at
 * the equinoxes), longitude tracks the time of day (the sun sits over the meridian where it is
 * solar noon).
 */
export function subsolarPoint(date: Date): SubsolarPoint {
  const dayOfYear = fractionalDayOfYear(date)
  const lat = OBLIQUITY_DEG * Math.sin(((2 * Math.PI) / 365.25) * (dayOfYear - REFERENCE_DAY))
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / (MS_PER_HOUR / 1000)
  // It is solar noon 180° away from the meridian facing the sun at UTC midnight; each UTC hour
  // moves that meridian 15° west. Wrapped into (-180, 180].
  const lng = (((12 - utcHours) * 15 + 540) % 360) - 180
  return { lat, lng }
}
