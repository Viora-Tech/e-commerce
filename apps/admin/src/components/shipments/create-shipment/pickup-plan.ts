import { DEFAULT_TIME_ZONE, wallClock } from '@commerce/dates'
import { todayKey } from '@/lib/format-date'

/** A start time as typed: "14:00" or "9:30". */
export const TIME_24H = /^\d{1,2}:\d{2}$/

/** How many days ahead the pickup day cards go: today, tomorrow, the day after. */
export const PICKUP_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000

/** From this hour (the store's clock, Asia/Kolkata) the pickup starts on tomorrow, not today. */
const TOMORROW_FROM_HOUR = 12

/** "YYYY-MM-DD" for `offset` days after `now`. */
export function pickupDayKey(offset: number, now: Date = new Date()): string {
  return todayKey(new Date(now.getTime() + offset * DAY_MS))
}

export type PickupPlan = {
  /** The "Ask the courier to collect" switch. */
  ask: boolean
  /** "YYYY-MM-DD". */
  date: string
  /** 24h start time as typed. */
  timeFrom: string
}

/**
 * Today before noon in India, tomorrow from noon: most couriers stop taking same-day pickups
 * around midday. Today stays pickable either way (the merchant knows their courier).
 */
export const startingPickupPlan = (now: Date = new Date()): PickupPlan => ({
  ask: true,
  date: pickupDayKey(
    wallClock(now, DEFAULT_TIME_ZONE).getUTCHours() >= TOMORROW_FROM_HOUR ? 1 : 0,
    now,
  ),
  timeFrom: '14:00',
})

/** Whether the plan is complete enough to send to the courier: a start time, and today or later. */
export const pickupReady = (plan: PickupPlan, today: string = todayKey()): boolean =>
  plan.date !== '' && plan.date >= today && TIME_24H.test(plan.timeFrom)

/** Couriers stop taking same-day pickups at about 2 pm in India (Delhivery's cut-off). */
export const PICKUP_CUTOFF_HOUR = 14

/** One day card in the Create pickup drawer (Figma 905:8280). */
export type PickupDay = {
  /** "YYYY-MM-DD". */
  date: string
  /** 0 today, 1 tomorrow, 2 or 3 the next working day after (a Sunday is skipped). */
  offset: number
  /** Today after the courier's cut-off: greyed out unless a pickup is already booked that day. */
  pastCutoff: boolean
}

/** Whether a "YYYY-MM-DD" day is a Sunday, when couriers do not collect. */
const isSunday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay() === 0

/**
 * Today, tomorrow and the next working day after that (a Sunday is skipped), in the store's
 * clock; today is past cut-off from 2 pm.
 */
export function pickupDays(now: Date = new Date()): PickupDay[] {
  const late = wallClock(now, DEFAULT_TIME_ZONE).getUTCHours() >= PICKUP_CUTOFF_HOUR
  const third = isSunday(pickupDayKey(2, now)) ? 3 : 2
  return [0, 1, third].map((offset) => ({
    date: pickupDayKey(offset, now),
    offset,
    pastCutoff: offset === 0 && late,
  }))
}

/** Start times on the half hour, 09:00 to 19:00: what couriers take a pickup window in. */
export const PICKUP_TIMES = Array.from({ length: 21 }, (_, i) => {
  const minutes = 9 * 60 + i * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

/**
 * The day the drawer starts on: the first day a pickup is already booked (joining it sends no
 * new request), else the first day still open for a new one.
 */
export function startingPickupDay(days: PickupDay[], bookedOn: (date: string) => boolean): string {
  const booked = days.find((d) => bookedOn(d.date))
  const open = days.find((d) => !d.pastCutoff)
  return (booked ?? open ?? days[0])?.date ?? ''
}
