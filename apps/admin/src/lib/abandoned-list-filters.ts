import { parseAsString, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { abandonedFiltersContent } from '@/data/order-list-filters'
import { dateFilterBounds, hasDateFilter, parseAsDateFilter } from '@/lib/date-filter'
import { DAY_PRESETS, daysBackStart, moneyRangeGroup, paiseBound } from '@/lib/list-filter-groups'

/** Mirrors ABANDONED_CONTACTS in core: an email, a phone number, or both. */
export const CONTACT_FILTERS = ['email', 'phone', 'both'] as const
export type ContactFilter = (typeof CONTACT_FILTERS)[number]

/** The Abandoned checkouts filter panel. With no Last active the list keeps its 30 day window. */
export type AbandonedFilters = {
  active: DateFilterValue
  /** Rupees as typed; empty for no bound. */
  valueMin: string
  valueMax: string
  contact: ContactFilter | null
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const ABANDONED_FILTER_PARAMS = {
  active: parseAsDateFilter(DAY_PRESETS),
  valueMin: parseAsString.withDefault(''),
  valueMax: parseAsString.withDefault(''),
  contact: parseAsStringLiteral(CONTACT_FILTERS),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_ABANDONED_FILTERS = {
  active: null,
  valueMin: null,
  valueMax: null,
  contact: null,
}

export function hasAbandonedFilters(f: AbandonedFilters): boolean {
  return (
    hasDateFilter(f.active) ||
    paiseBound(f.valueMin) !== null ||
    paiseBound(f.valueMax) !== null ||
    f.contact !== null
  )
}

/** The panel as `orders.listAbandoned` input; Last active's start replaces the 30 day window. */
export function abandonedFilterInput(f: AbandonedFilters, now = new Date()) {
  const active = dateFilterBounds(f.active, daysBackStart, now)
  const min = paiseBound(f.valueMin)
  const max = paiseBound(f.valueMax)
  return {
    ...(active.from ? { activeFrom: active.from } : {}),
    ...(active.to ? { activeTo: active.to } : {}),
    ...(min !== null ? { valueMinPaise: min } : {}),
    ...(max !== null ? { valueMaxPaise: max } : {}),
    ...(f.contact ? { contact: f.contact } : {}),
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function abandonedFilterGroups(
  f: AbandonedFilters,
  copy: typeof abandonedFiltersContent,
  onChange: (patch: Partial<AbandonedFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'active',
      label: copy.active,
      type: 'date',
      presets: DAY_PRESETS.map((d) => ({ value: d, label: copy.dateOptions[d] })),
      value: f.active,
      onChange: (active) => onChange({ active }),
      anyLabel: copy.anyDate,
    },
    moneyRangeGroup({
      key: 'value',
      label: copy.value,
      from: f.valueMin,
      to: f.valueMax,
      fromLabel: copy.valueMin,
      toLabel: copy.valueMax,
      onChange: ({ from, to }) =>
        onChange({
          ...(from === undefined ? {} : { valueMin: from }),
          ...(to === undefined ? {} : { valueMax: to }),
        }),
    }),
    {
      key: 'contact',
      label: copy.contact,
      type: 'select',
      options: CONTACT_FILTERS.map((c) => ({ value: c, label: copy.contactOptions[c] })),
      value: f.contact,
      onChange: (next) => onChange({ contact: CONTACT_FILTERS.find((c) => c === next) ?? null }),
      anyLabel: copy.anyContact,
    },
  ]
}
