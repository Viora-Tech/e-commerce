/**
 * The calendar periods the store AI's sales tools answer for (audit #103): "this month",
 * "last week", a custom date range, or the rolling last N days. Before, the tools only took N
 * days, so "this month" quietly became the last 30 days. Pure: the store's time zone decides
 * where days, weeks (Monday first) and months start. Each period comes with the window before
 * it, the same length, for "compared with".
 */
import { dayKey, dayStart, startOfDay, startOfMonth } from '@commerce/dates'
import { z } from 'zod'

const DAY_MS = 86_400_000

export const AI_PERIODS = [
  'days',
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'custom',
] as const
export type AiPeriod = (typeof AI_PERIODS)[number]

/** The tools' shared input: a named period, or N days, or a custom from–to (both days count). */
export const periodInput = (defaultDays: number) => ({
  period: z
    .enum(AI_PERIODS)
    .default('days')
    .describe(
      'Which period: "days" = the last N days including today; today, yesterday, this_week, last_week, this_month, last_month, this_year (calendar, store time zone); "custom" = from–to.',
    ),
  days: z.number().int().min(1).max(366).default(defaultDays),
  from: z.iso.date().optional().describe('Custom period: first day, YYYY-MM-DD.'),
  to: z.iso.date().optional().describe('Custom period: last day, YYYY-MM-DD (included).'),
})

export type PeriodInput = {
  period: AiPeriod
  days: number
  from?: string | undefined
  to?: string | undefined
}

export type ResolvedPeriod = {
  from: Date
  to: Date
  /** The window just before, the same length. */
  prevFrom: Date
  prevTo: Date
  /** How the answer names it: "this month (1 Oct – 31 Oct)". */
  label: string
}

function span(from: Date, to: Date, timeZone: string): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone }).format(d)
  const last = new Date(to.getTime() - 1)
  return dayKey(from, timeZone) === dayKey(last, timeZone)
    ? fmt(from)
    : `${fmt(from)} – ${fmt(last)}`
}

/** The window for `input` at `now` in `timeZone`; a period still running ends at `now`. */
export function resolvePeriod(input: PeriodInput, now: Date, timeZone: string): ResolvedPeriod {
  const today = startOfDay(now, timeZone)
  const weekday = (new Date(today.getTime() + DAY_MS / 2).getUTCDay() + 6) % 7
  let from: Date
  let to: Date = now
  let name: string
  switch (input.period) {
    case 'today':
      from = today
      name = 'today'
      break
    case 'yesterday':
      from = startOfDay(now, timeZone, -1)
      to = today
      name = 'yesterday'
      break
    case 'this_week':
      from = startOfDay(now, timeZone, -weekday)
      name = 'this week'
      break
    case 'last_week':
      from = startOfDay(now, timeZone, -weekday - 7)
      to = startOfDay(now, timeZone, -weekday)
      name = 'last week'
      break
    case 'this_month':
      from = startOfMonth(now, timeZone)
      name = 'this month'
      break
    case 'last_month':
      from = startOfMonth(now, timeZone, -1)
      to = startOfMonth(now, timeZone)
      name = 'last month'
      break
    case 'this_year': {
      const month = Number(
        new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone }).format(now),
      )
      from = startOfMonth(now, timeZone, -(month - 1))
      name = 'this year'
      break
    }
    case 'custom':
      if (input.from && input.to && input.from <= input.to) {
        from = dayStart(input.from, timeZone)
        to = new Date(Math.min(dayStart(input.to, timeZone).getTime() + DAY_MS, now.getTime()))
        name = 'the chosen dates'
        break
      }
      from = startOfDay(now, timeZone, -(input.days - 1))
      name = input.days === 1 ? 'today' : `last ${input.days} days`
      break
    default:
      from = startOfDay(now, timeZone, -(input.days - 1))
      name = input.days === 1 ? 'today' : `last ${input.days} days`
  }
  const length = Math.max(to.getTime() - from.getTime(), 0)
  return {
    from,
    to,
    prevFrom: new Date(from.getTime() - length),
    prevTo: from,
    label: `${name} (${span(from, to, timeZone)})`,
  }
}
