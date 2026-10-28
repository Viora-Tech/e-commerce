export type FilterOption = { value: string; label: string }

/** The date preset that shows the From and To fields. */
export const DATE_CUSTOM = 'custom'

type GroupBase = {
  key: string
  label: string
}

/** A list of tick boxes; the value is the ticked option values, in option order. */
export type ChecksGroup = GroupBase & {
  type: 'checks'
  options: readonly FilterOption[]
  value: string[]
  onChange: (next: string[]) => void
}

/** One choice out of a list; `null` is "any" (no filter). */
export type SelectGroup = GroupBase & {
  type: 'select'
  options: readonly FilterOption[]
  value: string | null
  onChange: (next: string | null) => void
  anyLabel: string
}

export type RangePatch = { from?: string; to?: string }

/** A min and an optional max, kept as strings so typing "12." survives. Empty = no bound. */
export type RangeGroup = GroupBase & {
  type: 'range'
  input: 'money' | 'number'
  from: string
  /** Leave out for a single "at least" input. */
  to?: string
  onChange: (patch: RangePatch) => void
  fromLabel?: string
  toLabel?: string
  /** How a bound reads in the applied chip (default: as typed, with the rupee sign for money). */
  format?: (value: string) => string
}

/** Free text the rows must contain ("pd170"); empty = no filter. The chip shows it as typed. */
export type TextGroup = GroupBase & {
  type: 'text'
  value: string
  onChange: (next: string) => void
  placeholder?: string
}

/** Several values out of a long list (vendors, tags, states), found by typing; [] = no filter. */
export type MultiGroup = GroupBase & {
  type: 'multi'
  options: readonly FilterOption[]
  value: string[]
  onChange: (next: string[]) => void
  /** The search box's placeholder (default: the panel's "Search"). */
  searchPlaceholder?: string
}

/**
 * A date range: one of the group's presets ("Last 7 days") or a custom from–to (`DATE_CUSTOM`),
 * as yyyy-mm-dd in the store's day. Both empty and no preset = no filter.
 */
export type DateFilterValue = { preset: string | null; from: string; to: string }

export type DateGroup = GroupBase & {
  type: 'date'
  presets: readonly FilterOption[]
  value: DateFilterValue
  onChange: (next: DateFilterValue) => void
  anyLabel: string
}

/** Yes, no or either (`null`): GST number given, has photos, subscribed. */
export type BooleanGroup = GroupBase & {
  type: 'boolean'
  value: boolean | null
  onChange: (next: boolean | null) => void
  yesLabel?: string
  noLabel?: string
}

export type FilterGroup =
  | ChecksGroup
  | SelectGroup
  | RangeGroup
  | TextGroup
  | MultiGroup
  | DateGroup
  | BooleanGroup

/** Plain strings (vendors, tags) as options whose label is the value. */
export function facetOptions(values: string[]): FilterOption[] {
  return values.map((v) => ({ value: v, label: v }))
}
