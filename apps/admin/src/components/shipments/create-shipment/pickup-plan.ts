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
