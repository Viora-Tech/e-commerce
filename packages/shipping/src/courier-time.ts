/** IST is UTC+5:30 all year. */
const IST = '+05:30'

const pad = (n: string) => n.padStart(2, '0')

/**
 * A courier's scan time as an ISO instant, or null when it cannot be read.
 *
 * Indian couriers write India time with no offset ("2026-09-22 08:00:00", "22-09-2026 08:00").
 * `new Date()` reads those in the server's own timezone, which is UTC in the containers, so every
 * scan landed 5 h 30 min late; and an unreadable value made `toISOString()` throw, failing the
 * whole tracking poll. Read here: a value with its own offset or `Z` as it says; a bare date or
 * date-time (year first or day first, `-`, `/` or `.`) as India time; anything else null.
 */
export function courierTimeToIso(raw: string | null | undefined): string | null {
  const s = raw?.trim() ?? ''
  if (!s) return null
  const time = '(?:[ T](\\d{1,2}):(\\d{2})(?::(\\d{2}))?(?:\\.\\d+)?)?'
  const ymd = new RegExp(`^(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})${time}$`).exec(s)
  const dmy = new RegExp(`^(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4})${time}$`).exec(s)
  const parts = ymd
    ? { y: ymd[1], m: ymd[2], d: ymd[3], h: ymd[4], mi: ymd[5], sec: ymd[6] }
    : dmy
      ? { y: dmy[3], m: dmy[2], d: dmy[1], h: dmy[4], mi: dmy[5], sec: dmy[6] }
      : null
  if (parts) {
    const { y = '', m = '', d = '', h = '0', mi = '0', sec = '0' } = parts
    const iso = `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(sec)}${IST}`
    const t = Date.parse(iso)
    // Date.parse rolls 31-02 over to March; a date that does not round-trip is not a date.
    const day = new Date(t + 330 * 60_000).toISOString().slice(0, 10)
    return Number.isNaN(t) || day !== `${y}-${pad(m)}-${pad(d)}` ? null : new Date(t).toISOString()
  }
  // Only a value that names its own zone is trusted to Date.parse.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}
