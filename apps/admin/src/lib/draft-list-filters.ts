import { parseAsString } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { draftFiltersContent } from '@/data/order-list-filters'
import { dateFilterBounds, hasDateFilter, parseAsDateFilter } from '@/lib/date-filter'
import { DAY_PRESETS, daysBackStart, moneyRangeGroup, paiseBound } from '@/lib/list-filter-groups'

/** The Drafts filter panel: when it was made and what it adds up to. */
export type DraftFilters = {
  created: DateFilterValue
  /** Rupees as typed; empty for no bound. */
  totalMin: string
  totalMax: string
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const DRAFT_FILTER_PARAMS = {
  created: parseAsDateFilter(DAY_PRESETS),
  totalMin: parseAsString.withDefault(''),
  totalMax: parseAsString.withDefault(''),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_DRAFT_FILTERS = { created: null, totalMin: null, totalMax: null }

export function hasDraftFilters(f: DraftFilters): boolean {
  return (
    hasDateFilter(f.created) || paiseBound(f.totalMin) !== null || paiseBound(f.totalMax) !== null
  )
}

/** The panel as `orders.listDrafts` input. */
export function draftFilterInput(f: DraftFilters, now = new Date()) {
  const created = dateFilterBounds(f.created, daysBackStart, now)
  const min = paiseBound(f.totalMin)
  const max = paiseBound(f.totalMax)
  return {
    ...(created.from ? { createdFrom: created.from } : {}),
    ...(created.to ? { createdTo: created.to } : {}),
    ...(min !== null ? { totalMinPaise: min } : {}),
    ...(max !== null ? { totalMaxPaise: max } : {}),
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function draftFilterGroups(
  f: DraftFilters,
  copy: typeof draftFiltersContent,
  onChange: (patch: Partial<DraftFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'created',
      label: copy.created,
      type: 'date',
      presets: DAY_PRESETS.map((d) => ({ value: d, label: copy.dateOptions[d] })),
      value: f.created,
      onChange: (created) => onChange({ created }),
      anyLabel: copy.anyDate,
    },
    moneyRangeGroup({
      key: 'total',
      label: copy.total,
      from: f.totalMin,
      to: f.totalMax,
      fromLabel: copy.totalMin,
      toLabel: copy.totalMax,
      onChange: ({ from, to }) =>
        onChange({
          ...(from === undefined ? {} : { totalMin: from }),
          ...(to === undefined ? {} : { totalMax: to }),
        }),
    }),
  ]
}
