export type FilterOption = { value: string; label: string }

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

export type FilterGroup = ChecksGroup | SelectGroup | RangeGroup | TextGroup

/** Plain strings (vendors, tags) as options whose label is the value. */
export function facetOptions(values: string[]): FilterOption[] {
  return values.map((v) => ({ value: v, label: v }))
}
