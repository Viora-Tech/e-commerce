import { parseRupees } from '@commerce/money'
import type { RangeGroup } from '@/components/table/filter-panel'
import { formatPaise } from '@/lib/money'

/** The "last N days" presets most list date filters offer; a custom from–to is the group's own. */
export const DAY_PRESETS = ['7d', '30d', '90d'] as const
export type DayPreset = (typeof DAY_PRESETS)[number]

const DAYS: Record<DayPreset, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** When a day preset starts: that many days back from now. */
export function daysBackStart(preset: string, now: Date): Date | null {
  const days = DAY_PRESETS.find((d) => d === preset)
  return days ? new Date(now.getTime() - DAYS[days] * 86_400_000) : null
}

/** A rupee bound as typed, as paise never below zero; null when empty or not a number. */
export function paiseBound(value: string): number | null {
  const paise = parseRupees(value)
  return paise === null ? null : Math.max(0, paise)
}

/** A money min–max group whose ends are two URL fields (`totalMin`, `totalMax`). */
export function moneyRangeGroup(opts: {
  key: string
  label: string
  from: string
  to: string
  fromLabel: string
  toLabel: string
  onChange: (patch: { from?: string; to?: string }) => void
}): RangeGroup {
  return {
    ...opts,
    type: 'range',
    input: 'money',
    format: (v) => formatPaise(parseRupees(v) ?? 0),
  }
}
