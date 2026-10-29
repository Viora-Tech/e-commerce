import { parseRupees } from '@commerce/money'
import type { BooleanGroup, DateFilterValue, DateGroup } from '@/components/table/filter-panel'
import type { filterPanelContent } from '@/data/filter-panel'

/* Pieces the F5 list filters share (stock, content and app lists): the look-back date presets,
   yes/no in the URL and typed number bounds. */

/** "Last 7 / 30 / 90 days": a window from N days ago up to now. */
export const LAST_DAYS = ['7d', '30d', '90d'] as const
type LastDays = (typeof LAST_DAYS)[number]

const DAYS: Record<LastDays, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** A yes/no filter as it sits in the URL; `null` (no param) is either. */
export const YES_NO = ['yes', 'no'] as const
export type YesNo = (typeof YES_NO)[number]

type PanelCopy = typeof filterPanelContent

/** The start of a look-back preset, for `dateFilterBounds`. */
export function lastDaysStart(preset: string, now: Date): Date | null {
  const found = LAST_DAYS.find((p) => p === preset)
  return found ? new Date(now.getTime() - DAYS[found] * 86_400_000) : null
}

/** A URL yes/no as an API boolean; undefined when either. */
export function yesNoInput(v: YesNo | null): boolean | undefined {
  return v === null ? undefined : v === 'yes'
}

/** Rupees as typed ("499.5") in paise; null for empty, negative or not money. */
export function paiseBound(text: string): number | null {
  const paise = parseRupees(text)
  return paise === null ? null : Math.max(0, paise)
}

/** An ISO window as API fields: `{ createdFrom, createdTo }` for `name` = "created". */
export function windowInput<N extends string>(
  name: N,
  bounds: { from?: string; to?: string },
): Partial<Record<`${N}From` | `${N}To`, string>> {
  const out: Partial<Record<string, string>> = {}
  if (bounds.from) out[`${name}From`] = bounds.from
  if (bounds.to) out[`${name}To`] = bounds.to
  return out
}

/** A date group with the look-back presets (or none, for dates still to come). */
export function dateGroup(
  key: string,
  label: string,
  value: DateFilterValue,
  onChange: (next: DateFilterValue) => void,
  panel: PanelCopy,
  presets: 'lastDays' | 'customOnly' = 'lastDays',
): DateGroup {
  return {
    key,
    label,
    type: 'date',
    presets:
      presets === 'lastDays' ? LAST_DAYS.map((p) => ({ value: p, label: panel.lastDays[p] })) : [],
    value,
    onChange,
    anyLabel: panel.anyDate,
  }
}

/** A yes/no group over a URL yes/no value. */
export function yesNoGroup(
  key: string,
  label: string,
  value: YesNo | null,
  onChange: (next: YesNo | null) => void,
  labels: { yesLabel?: string; noLabel?: string } = {},
): BooleanGroup {
  return {
    key,
    label,
    type: 'boolean',
    value: value === null ? null : value === 'yes',
    onChange: (next) => onChange(next === null ? null : next ? 'yes' : 'no'),
    ...labels,
  }
}
