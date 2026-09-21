/**
 * Delivery date computation.
 *
 * PURE MODULE - no I/O, no Prisma, no Date.now(), no process.env. Everything
 * it needs arrives as arguments, which is what makes it testable (see
 * test/delivery-date.test.ts) and what makes the numbers on the storefront
 * defensible. Ported from the Waimers Shopify delivery-promise app.
 *
 * Why it is written this way
 * --------------------------
 * The naive version of this - `new Date(Date.now() + days * 86400000)` - is
 * wrong in four separate ways, and every one of them produces a date that
 * looks plausible while being off by a day or more:
 *
 *  1. It uses the *server's* clock and calendar. Deployed to a Frankfurt or
 *     Virginia region, "today" flips over at 05:30 or 09:30 IST. An order at
 *     10pm IST on Monday would be told it dispatches Monday - a day that ended
 *     four hours earlier in the warehouse. Every calculation here happens on
 *     the *civil* date in the shop's timezone.
 *  2. It counts calendar days, so it happily promises Sunday delivery and
 *     dispatch on Diwali.
 *  3. Adding milliseconds crosses DST boundaries incorrectly. India has no
 *     DST, but the app should not silently break if a merchant sets a zone
 *     that does. Day arithmetic here is done on integer day numbers, never on
 *     epoch milliseconds, so DST cannot leak in.
 *  4. It ignores the dispatch cutoff entirely, which is the single biggest
 *     source of a one-day error.
 *
 * The bias throughout is to promise *late* rather than early. A parcel that
 * arrives ahead of the promise is a pleasant surprise; one that arrives after
 * it is a support ticket.
 */

export type CalendarPolicy = {
  /** ISO-8601 weekday numbers the warehouse DISPATCHES on: Mon=1 .. Sun=7. */
  workingDays: number[]
  /**
   * Weekday numbers couriers DELIVER on. Usually not the same set: a shop
   * closed on Sunday is still receiving deliveries that day, because the
   * parcel left days earlier and the courier works weekends.
   *
   * Omitted, it falls back to workingDays, which is what this module assumed
   * before the two were separated - and which over-promises by a day on every
   * transit that crosses a Sunday.
   */
  deliveryDays?: number[]
  /** Extra non-working dates, "YYYY-MM-DD". Order and duplicates do not matter. */
  holidays: string[]
}

export type DispatchPolicy = CalendarPolicy & {
  /** Local wall-clock cutoff, "HH:mm" in 24h form. */
  cutoff: string
  /** IANA timezone the cutoff and calendar are evaluated in, e.g. "Asia/Kolkata". */
  timeZone: string
}

export type EstimateInput = {
  /** The instant the customer is asking. Injected so tests can pin it. */
  now: Date
  /** Courier transit time, in days, as reported by the adapter. */
  minTransitDays: number
  maxTransitDays: number
  policy: DispatchPolicy
}

export type EstimateResult = {
  /** Civil date in the shop's timezone at `now`, "YYYY-MM-DD". */
  orderedOn: string
  /** The working day the parcel leaves the warehouse, "YYYY-MM-DD". */
  dispatchDate: string
  /** True when the order still makes today's dispatch - the useful urgency cue. */
  dispatchesToday: boolean
  /** Earliest and latest delivery dates, "YYYY-MM-DD". */
  earliestDate: string
  latestDate: string
  /** Whole calendar days from `orderedOn` to each delivery date. */
  minDays: number
  maxDays: number
}

/** Thrown for policies that can never produce an answer. Callers must handle it. */
export class ImpossibleCalendarError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImpossibleCalendarError'
  }
}

// ---------------------------------------------------------------------------
// Civil date primitives
//
// A "civil date" here is the string "YYYY-MM-DD" - a date with no time and no
// zone. All arithmetic converts to an integer day number and back. Date.UTC is
// used purely as a proleptic-Gregorian calculator; because UTC never shifts,
// the round-trip is exact and no timezone can contaminate it.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000
const CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Guard against runaway scans when a policy leaves too few working days. */
const MAX_CALENDAR_SCAN_DAYS = 400

/** True for a syntactically well-formed date that also exists ("2026-02-31" does not). */
export function isCivilDate(value: unknown): value is string {
  return typeof value === 'string' && tryDayNumber(value) !== null
}

function tryDayNumber(civil: string): number | null {
  const match = CIVIL_DATE_RE.exec(civil)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const ms = Date.UTC(year, month - 1, day)
  if (Number.isNaN(ms)) return null
  // Date.UTC(2026, 1, 31) silently rolls over to March 3rd. A round-trip that
  // does not come back with the same fields means the input was not a real date.
  const roundTrip = new Date(ms)
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return null
  }
  return ms / MS_PER_DAY
}

function toDayNumber(civil: string): number {
  const dayNumber = tryDayNumber(civil)
  if (dayNumber === null) {
    throw new TypeError(`Not a valid YYYY-MM-DD date: ${JSON.stringify(civil)}`)
  }
  return dayNumber
}

function fromDayNumber(dayNumber: number): string {
  const date = new Date(dayNumber * MS_PER_DAY)
  const y = String(date.getUTCFullYear()).padStart(4, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * ISO-8601 weekday for a civil date: Monday=1 .. Sunday=7.
 * Day number 0 is 1970-01-01, a Thursday (ISO 4), hence the +3 offset.
 */
export function isoWeekday(civil: string): number {
  const n = toDayNumber(civil)
  return ((((n + 3) % 7) + 7) % 7) + 1
}

/** Whole calendar days from `from` to `to`. Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from)
}

export function addCalendarDays(civil: string, days: number): string {
  return fromDayNumber(toDayNumber(civil) + days)
}

// ---------------------------------------------------------------------------
// Working-day calendar
// ---------------------------------------------------------------------------

type NormalisedCalendar = {
  workingDays: Set<number>
  /** Days a parcel can ARRIVE. See CalendarPolicy.deliveryDays. */
  deliveryDays: Set<number>
  /** Exact dates, "YYYY-MM-DD" - a festival that moves each year. */
  holidays: Set<string>
  /** "MM-DD", closed every year - Republic Day is always 26 January. */
  recurring: Set<string>
}

function normaliseCalendar(policy: CalendarPolicy): NormalisedCalendar {
  const workingDays = new Set<number>()
  for (const day of policy.workingDays) {
    if (Number.isInteger(day) && day >= 1 && day <= 7) workingDays.add(day)
  }
  if (workingDays.size === 0) {
    throw new ImpossibleCalendarError(
      'No working days configured - every day would be skipped forever.',
    )
  }
  // Malformed holiday entries are dropped rather than thrown on: the list is
  // merchant-entered free text, and one typo should not take the storefront's
  // delivery promise offline. Settings validation rejects them at the point of
  // entry, which is where the merchant can actually see the error.
  const holidays = new Set(policy.holidays.filter(isCivilDate))
  /* Entries without a year recur. Storing "2026-01-26" for a date that is a
     holiday EVERY year means the calendar quietly expires: the merchant sets
     it once and the app starts promising deliveries on Republic Day the
     following January. */
  const recurring = new Set(policy.holidays.filter((h) => /^\d{2}-\d{2}$/.test(h)))

  /* Falls back to the dispatch week when unset, which keeps every existing
     shop's promises exactly where they were. Holidays still apply to both:
     couriers work Sundays, they do not work Republic Day. */
  const deliveryDays = new Set<number>()
  for (const day of policy.deliveryDays ?? []) {
    if (Number.isInteger(day) && day >= 1 && day <= 7) deliveryDays.add(day)
  }
  if (deliveryDays.size === 0) {
    for (const day of workingDays) deliveryDays.add(day)
  }

  return { workingDays, deliveryDays, holidays, recurring }
}

export function isWorkingDay(civil: string, policy: CalendarPolicy): boolean {
  const calendar = normaliseCalendar(policy)
  return isWorkingDayIn(civil, calendar)
}

/** Can a parcel ARRIVE on this date? */
function isDeliveryDayIn(civil: string, calendar: NormalisedCalendar): boolean {
  if (!calendar.deliveryDays.has(isoWeekday(civil))) return false
  if (calendar.holidays.has(civil)) return false
  return !calendar.recurring.has(civil.slice(5))
}

function nextDeliveryDayIn(civil: string, calendar: NormalisedCalendar): string {
  let cursor = civil
  for (let i = 0; i < MAX_CALENDAR_SCAN_DAYS; i++) {
    cursor = addCalendarDays(cursor, 1)
    if (isDeliveryDayIn(cursor, calendar)) return cursor
  }
  throw new ImpossibleCalendarError(
    `No delivery day within ${MAX_CALENDAR_SCAN_DAYS} days of ${civil} - ` +
      'the holiday list probably covers every delivery weekday.',
  )
}

/** Advance `days` delivery days from a dispatch date. */
function addDeliveryDaysIn(civil: string, days: number, calendar: NormalisedCalendar): string {
  let cursor = civil
  for (let i = 0; i < days; i++) {
    cursor = nextDeliveryDayIn(cursor, calendar)
  }
  return cursor
}

function isWorkingDayIn(civil: string, calendar: NormalisedCalendar): boolean {
  if (!calendar.workingDays.has(isoWeekday(civil))) return false
  if (calendar.holidays.has(civil)) return false
  /* "YYYY-MM-DD".slice(5) is "MM-DD". */
  return !calendar.recurring.has(civil.slice(5))
}

function nextWorkingDayIn(civil: string, calendar: NormalisedCalendar): string {
  let cursor = civil
  for (let i = 0; i < MAX_CALENDAR_SCAN_DAYS; i++) {
    cursor = addCalendarDays(cursor, 1)
    if (isWorkingDayIn(cursor, calendar)) return cursor
  }
  throw new ImpossibleCalendarError(
    `No working day found within ${MAX_CALENDAR_SCAN_DAYS} days of ${civil} - ` +
      'the holiday list probably covers every working weekday.',
  )
}

/** The next working day strictly after `civil`. */
export function nextWorkingDay(civil: string, policy: CalendarPolicy): string {
  return nextWorkingDayIn(civil, normaliseCalendar(policy))
}

function addWorkingDaysIn(civil: string, days: number, calendar: NormalisedCalendar): string {
  let cursor = civil
  for (let i = 0; i < days; i++) {
    cursor = nextWorkingDayIn(cursor, calendar)
  }
  return cursor
}

/** Advance `days` working days from `civil`, skipping non-working days. */
export function addWorkingDays(civil: string, days: number, policy: CalendarPolicy): string {
  if (!Number.isInteger(days) || days < 0) {
    throw new TypeError(`addWorkingDays needs a non-negative integer, got ${days}`)
  }
  return addWorkingDaysIn(civil, days, normaliseCalendar(policy))
}

// ---------------------------------------------------------------------------
// Wall clock in a named timezone
// ---------------------------------------------------------------------------

export type ZonedNow = {
  /** Civil date in that zone, "YYYY-MM-DD". */
  date: string
  /** Minutes since local midnight, 0..1439. */
  minutesSinceMidnight: number
}

/**
 * The civil date and wall-clock time at `instant`, as seen in `timeZone`.
 *
 * Intl is the only correct way to do this without shipping a timezone
 * database. `hourCycle: "h23"` matters: the default for many locales renders
 * midnight as hour "24", which parses to 1440 minutes and silently pushes
 * every midnight order past the cutoff.
 */
export function zonedNow(instant: Date, timeZone: string): ZonedNow {
  if (Number.isNaN(instant.getTime())) {
    throw new TypeError('zonedNow received an invalid Date')
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((p) => p.type === type)
    if (!part) throw new TypeError(`Intl gave no "${type}" part for zone ${timeZone}`)
    return part.value
  }

  const date = `${get('year')}-${get('month')}-${get('day')}`
  const minutes = Number(get('hour')) * 60 + Number(get('minute'))
  return { date, minutesSinceMidnight: minutes }
}

/** Parse "HH:mm" into minutes since midnight. Throws on anything else. */
export function parseCutoff(cutoff: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(cutoff.trim())
  if (!match) {
    throw new TypeError(`Cutoff must look like "HH:mm", got ${JSON.stringify(cutoff)}`)
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) {
    throw new TypeError(`Cutoff is not a real time: ${cutoff}`)
  }
  return hours * 60 + minutes
}

/** True when `timeZone` is a zone Intl actually knows. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone })
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// The estimate
// ---------------------------------------------------------------------------

/**
 * Compute the delivery window.
 *
 * Dispatch rule: an order placed on a working day *strictly before* the cutoff
 * dispatches that same day. At the cutoff minute exactly, it does not - the
 * warehouse has already closed the manifest, and boundary orders are the ones
 * most likely to be complained about, so they get the later promise.
 *
 * Transit rule: transit days are counted on the DELIVERY calendar, which is
 * not the warehouse's. Once the parcel is with the courier, whether the shop
 * is open has stopped mattering - and Indian couriers deliver on Sundays even
 * where nobody is there to hand them anything. Counting transit on the
 * dispatch week, which this module did until the two were separated, added a
 * day to every promise that crossed a Sunday.
 *
 * Holidays still apply to both. Couriers work Sundays; they do not work
 * Republic Day.
 */
export function computeDeliveryEstimate(input: EstimateInput): EstimateResult {
  const { now, policy } = input
  const calendar = normaliseCalendar(policy)
  const cutoffMinutes = parseCutoff(policy.cutoff)

  const { date: orderedOn, minutesSinceMidnight } = zonedNow(now, policy.timeZone)

  // A courier reporting 0 transit days would mean handing the parcel over and
  // having it arrive the same instant. No Indian courier means that; treat it
  // as "next day" rather than propagating a nonsense zero into the promise.
  let minTransit = Math.max(1, Math.ceil(input.minTransitDays))
  let maxTransit = Math.max(1, Math.ceil(input.maxTransitDays))
  if (minTransit > maxTransit) {
    // Some aggregator responses put the optimistic figure second. Rather than
    // rendering "arrives between Friday and Tuesday", normalise the pair.
    ;[minTransit, maxTransit] = [maxTransit, minTransit]
  }

  const canDispatchToday =
    isWorkingDayIn(orderedOn, calendar) && minutesSinceMidnight < cutoffMinutes
  const dispatchDate = canDispatchToday ? orderedOn : nextWorkingDayIn(orderedOn, calendar)

  /* Transit counts DELIVERY days, not the warehouse's. The parcel is already
     with the courier; whether the shop is open has stopped mattering. */
  const earliestDate = addDeliveryDaysIn(dispatchDate, minTransit, calendar)
  const latestDate = addDeliveryDaysIn(dispatchDate, maxTransit, calendar)

  return {
    orderedOn,
    dispatchDate,
    dispatchesToday: canDispatchToday,
    earliestDate,
    latestDate,
    minDays: daysBetween(orderedOn, earliestDate),
    maxDays: daysBetween(orderedOn, latestDate),
  }
}

/**
 * Human-readable range for the storefront, e.g.
 *   "Tue, 18 Aug" (both ends equal)
 *   "Tue, 18 Aug - Thu, 20 Aug"
 *
 * Formatted server-side rather than in the theme so that the string the
 * customer reads is the string the app can reproduce in a support query.
 */
export function formatDeliveryRange(
  earliestDate: string,
  latestDate: string,
  locale = 'en-IN',
): string {
  const format = (civil: string): string =>
    new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC', // civil dates are constructed at UTC midnight above
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${civil}T00:00:00Z`))

  return earliestDate === latestDate
    ? format(earliestDate)
    : `${format(earliestDate)} - ${format(latestDate)}`
}

// ---------------------------------------------------------------------------
// The transit track
// ---------------------------------------------------------------------------

export type TrackDay = {
  /** Civil date, "YYYY-MM-DD". */
  d: string
  /** True when the parcel can actually move on this day. */
  w: boolean
}

/**
 * One entry per calendar day from dispatch to the latest delivery date, each
 * marked working or not.
 *
 * This exists because a date range throws away the SHAPE of the wait, and the
 * shape is the part customers are actually uncertain about - "five days" reads
 * very differently once you can see that two of them are a weekend when
 * nothing moves. The widget draws this as a row of pips; filled days are days
 * the parcel travels, hollow ones are days it sits.
 *
 * Derived from the same policy the estimate used, so the picture cannot
 * disagree with the dates printed above it. Recomputing it in the browser from
 * a weekday rule would be a second implementation of the calendar, and the
 * second implementation is the one that gets the holidays wrong.
 */
export function buildTrack(
  dispatchDate: string,
  latestDate: string,
  policy: CalendarPolicy,
): TrackDay[] {
  const span = daysBetween(dispatchDate, latestDate)
  if (span < 0) return []

  /* Bounded for the same reason the working-day scan is: a corrupt latestDate
     must not turn into an unbounded loop that allocates until the process
     dies. A track longer than this is not renderable anyway. */
  const limit = Math.min(span, 60)

  const days: TrackDay[] = []
  for (let i = 0; i <= limit; i++) {
    const date = addCalendarDays(dispatchDate, i)
    days.push({ d: date, w: isWorkingDay(date, policy) })
  }
  return days
}

/**
 * One civil date, short form: "Mon 17 Aug". Used for the track's end labels,
 * where the year is noise and the weekday is the useful part - "Mon" is what
 * tells someone the parcel is not sitting over a weekend.
 *
 * timeZone: "UTC" for the same reason formatDeliveryRange uses it: civil dates
 * are constructed at UTC midnight, so formatting them in any other zone can
 * shift them a day.
 */
export function formatShortDate(civil: string, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${civil}T00:00:00Z`))
}
