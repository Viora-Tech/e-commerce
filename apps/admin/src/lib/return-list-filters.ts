import { RETURN_REASONS, RETURN_RESOLUTIONS } from '@commerce/core/returns'
import { parseAsArrayOf, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { returnFiltersContent } from '@/data/order-list-filters'
import { dateFilterBounds, hasDateFilter, parseAsDateFilter } from '@/lib/date-filter'
import { DAY_PRESETS, daysBackStart } from '@/lib/list-filter-groups'

type Reason = (typeof RETURN_REASONS)[number]
type Resolution = (typeof RETURN_RESOLUTIONS)[number]

/** The Returns filter panel; the tabs keep owning the status. Arrays are "any of". */
export type ReturnFilters = {
  reason: Reason[]
  outcome: Resolution[]
  requested: DateFilterValue
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const RETURN_FILTER_PARAMS = {
  reason: parseAsArrayOf(parseAsStringLiteral(RETURN_REASONS)).withDefault([]),
  outcome: parseAsArrayOf(parseAsStringLiteral(RETURN_RESOLUTIONS)).withDefault([]),
  requested: parseAsDateFilter(DAY_PRESETS),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_RETURN_FILTERS = { reason: null, outcome: null, requested: null }

export function hasReturnFilters(f: ReturnFilters): boolean {
  return f.reason.length > 0 || f.outcome.length > 0 || hasDateFilter(f.requested)
}

/** The panel as `returns.list` input. */
export function returnFilterInput(f: ReturnFilters, now = new Date()) {
  const requested = dateFilterBounds(f.requested, daysBackStart, now)
  return {
    ...(f.reason.length ? { reasons: f.reason } : {}),
    ...(f.outcome.length ? { resolutions: f.outcome } : {}),
    ...(requested.from ? { requestedFrom: requested.from } : {}),
    ...(requested.to ? { requestedTo: requested.to } : {}),
  }
}

/** Keeps the keys of `all` that were ticked, in `all`'s order. */
function pick<K extends string>(all: readonly K[], ticked: string[]): K[] {
  return all.filter((k) => ticked.includes(k))
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function returnFilterGroups(
  f: ReturnFilters,
  copy: typeof returnFiltersContent,
  onChange: (patch: Partial<ReturnFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'reason',
      label: copy.reason,
      type: 'checks',
      options: RETURN_REASONS.map((r) => ({ value: r, label: copy.reasonOptions[r] })),
      value: f.reason,
      onChange: (next) => onChange({ reason: pick(RETURN_REASONS, next) }),
    },
    {
      key: 'outcome',
      label: copy.outcome,
      type: 'checks',
      options: RETURN_RESOLUTIONS.map((r) => ({ value: r, label: copy.outcomeOptions[r] })),
      value: f.outcome,
      onChange: (next) => onChange({ outcome: pick(RETURN_RESOLUTIONS, next) }),
    },
    {
      key: 'requested',
      label: copy.requested,
      type: 'date',
      presets: DAY_PRESETS.map((d) => ({ value: d, label: copy.dateOptions[d] })),
      value: f.requested,
      onChange: (requested) => onChange({ requested }),
      anyLabel: copy.anyDate,
    },
  ]
}
