/**
 * Loyalty bonus campaigns, pure helpers for the admin Campaigns page: a campaign's status, its
 * bonus as words, and the week timeline strip (which weeks to draw and where each bar sits).
 * Weeks start on Monday in the store's day (IST).
 */
import { IST_OFFSET_MS } from '@commerce/dates'

export type CampaignStatus = 'scheduled' | 'running' | 'ended'

export type CampaignWindow = {
  id: string
  startsAt: Date | string
  endsAt: Date | string
  active: boolean
}

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

const ms = (d: Date | string) => new Date(d).getTime()

/** Switched off or past its end: ended; not started: scheduled; else running. */
export function campaignStatus(c: CampaignWindow, now: Date = new Date()): CampaignStatus {
  if (!c.active || ms(c.endsAt) <= now.getTime()) return 'ended'
  if (ms(c.startsAt) > now.getTime()) return 'scheduled'
  return 'running'
}

/** 20000 is "2x", 15000 "1.5x", 12500 "1.25x". */
export function multiplierLabel(bp: number): string {
  return `${Math.round(bp / 100) / 100}x`
}

/** Multiplier text ("1.5" or "2x") as basis points; null when not a number from 1 to 10. */
export function multiplierBpFrom(text: string): number | null {
  const n = Number(text.trim().replace(/x$/i, ''))
  if (text.trim() === '' || !Number.isFinite(n) || n < 1 || n > 10) return null
  return Math.round(n * 10_000)
}

/** The Monday (IST midnight, as an instant) of the week holding `at`. */
export function weekStart(at: Date): Date {
  const local = at.getTime() + IST_OFFSET_MS
  const dayIndex = Math.floor(local / DAY_MS)
  // Day 0 (1 Jan 1970) was a Thursday, so Monday is (index + 3) % 7 days back.
  const back = (((dayIndex + 3) % 7) + 7) % 7
  return new Date((dayIndex - back) * DAY_MS - IST_OFFSET_MS)
}

/** Week starts to draw: `before` weeks before this one, this week, then `after` weeks. */
export function timelineWeeks(now: Date, before = 2, after = 9): Date[] {
  const first = weekStart(now).getTime() - before * WEEK_MS
  return Array.from({ length: before + 1 + after }, (_, i) => new Date(first + i * WEEK_MS))
}

export type TimelineBar = {
  id: string
  /** Left edge and width as fractions (0..1) of the strip. */
  left: number
  width: number
  /** Row, from 0; bars that overlap in time get different rows. */
  lane: number
  /** The campaign runs on before or after the strip. */
  clippedStart: boolean
  clippedEnd: boolean
}

/**
 * Where each campaign sits on the strip that starts at `weeks[0]` and spans `weeks.length`
 * weeks. Campaigns wholly outside are left out; each overlapping one takes the first free row.
 */
export function timelineBars(
  campaigns: readonly CampaignWindow[],
  weeks: readonly Date[],
): TimelineBar[] {
  const first = weeks[0]
  if (!first) return []
  const start = first.getTime()
  const end = start + weeks.length * WEEK_MS
  const span = end - start
  const inView = campaigns
    .filter((c) => ms(c.endsAt) > start && ms(c.startsAt) < end)
    .sort((a, b) => ms(a.startsAt) - ms(b.startsAt))
  const laneEnds: number[] = []
  return inView.map((c) => {
    const from = Math.max(start, ms(c.startsAt))
    const to = Math.min(end, ms(c.endsAt))
    let lane = laneEnds.findIndex((e) => e <= from)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = to
    return {
      id: c.id,
      left: (from - start) / span,
      width: Math.max((to - from) / span, 0.01),
      lane,
      clippedStart: ms(c.startsAt) < start,
      clippedEnd: ms(c.endsAt) > end,
    }
  })
}

/** Where "now" falls on the strip (0..1), or null when off it. */
export function nowOffset(weeks: readonly Date[], now: Date): number | null {
  const first = weeks[0]
  if (!first) return null
  const f = (now.getTime() - first.getTime()) / (weeks.length * WEEK_MS)
  return f >= 0 && f <= 1 ? f : null
}
