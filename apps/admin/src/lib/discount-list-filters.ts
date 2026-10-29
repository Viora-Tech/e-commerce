import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import {
  DISCOUNT_LIFECYCLES,
  type DiscountLifecycle,
  type discountsContent,
} from '@/data/discounts'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'

/** Shopify's four types, as stored on the discount. */
export const DISCOUNT_TYPES = ['products', 'order', 'bxgy', 'shipping'] as const
export type DiscountTypeFilter = (typeof DISCOUNT_TYPES)[number]

/** Code (typed at checkout) or automatic. */
export const DISCOUNT_KINDS = ['code', 'automatic'] as const
export type DiscountKindFilter = (typeof DISCOUNT_KINDS)[number]

/** The Active dates presets: ran at some point in the last N days. */
export const ACTIVE_FILTERS = ['7d', '30d', '90d'] as const
type ActiveFilter = (typeof ACTIVE_FILTERS)[number]

const DAYS: Record<ActiveFilter, number> = { '7d': 7, '30d': 30, '90d': 90 }

const YES_NO = ['yes', 'no'] as const

/** What the Discounts filter panel holds; arrays are "any of", empty for no filter. */
export type DiscountFilters = {
  lifecycle: DiscountLifecycle[]
  type: DiscountTypeFilter[]
  kind: DiscountKindFilter[]
  /** Ran at some point in this window. */
  active: DateFilterValue
  /** Times used, whole numbers as typed; empty for no bound. */
  usedMin: string
  usedMax: string
  /** "yes" has used up its total limit, "no" has room or no limit; null for either. */
  limitReached: (typeof YES_NO)[number] | null
}

export const NO_DISCOUNT_FILTERS: DiscountFilters = {
  lifecycle: [],
  type: [],
  kind: [],
  active: NO_DATE_FILTER,
  usedMin: '',
  usedMax: '',
  limitReached: null,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change.
   `lifecycle` is the panel's own; the tab stays `?status=`. */
export const DISCOUNT_FILTER_PARAMS = {
  lifecycle: parseAsArrayOf(parseAsStringLiteral(DISCOUNT_LIFECYCLES)).withDefault([]),
  type: parseAsArrayOf(parseAsStringLiteral(DISCOUNT_TYPES)).withDefault([]),
  kind: parseAsArrayOf(parseAsStringLiteral(DISCOUNT_KINDS)).withDefault([]),
  active: parseAsDateFilter(ACTIVE_FILTERS),
  usedMin: parseAsString.withDefault(''),
  usedMax: parseAsString.withDefault(''),
  limitReached: parseAsStringLiteral(YES_NO),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_DISCOUNT_FILTERS = {
  lifecycle: null,
  type: null,
  kind: null,
  active: null,
  usedMin: null,
  usedMax: null,
  limitReached: null,
}

function whole(text: string): number | null {
  const n = Number.parseInt(text, 10)
  return Number.isFinite(n) ? Math.max(0, n) : null
}

function presetStart(preset: string, now: Date): Date | null {
  const found = ACTIVE_FILTERS.find((p) => p === preset)
  return found ? new Date(now.getTime() - DAYS[found] * 86_400_000) : null
}

export function hasDiscountFilters(f: DiscountFilters): boolean {
  return (
    f.lifecycle.length > 0 ||
    f.type.length > 0 ||
    f.kind.length > 0 ||
    hasDateFilter(f.active) ||
    whole(f.usedMin) !== null ||
    whole(f.usedMax) !== null ||
    f.limitReached !== null
  )
}

/** The panel as `discounts.list` input. */
export function discountFilterInput(f: DiscountFilters, now = new Date()) {
  const active = dateFilterBounds(f.active, presetStart, now)
  const usedMin = whole(f.usedMin)
  const usedMax = whole(f.usedMax)
  return {
    ...(f.lifecycle.length ? { lifecycles: f.lifecycle } : {}),
    ...(f.type.length ? { types: f.type } : {}),
    ...(f.kind.length ? { kinds: f.kind } : {}),
    ...(active.from ? { activeFrom: active.from } : {}),
    ...(active.to ? { activeTo: active.to } : {}),
    ...(usedMin !== null ? { usedMin } : {}),
    ...(usedMax !== null ? { usedMax } : {}),
    ...(f.limitReached ? { limitReached: f.limitReached === 'yes' } : {}),
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function discountFilterGroups(
  f: DiscountFilters,
  copy: (typeof discountsContent)['filters'],
  onChange: (patch: Partial<DiscountFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'lifecycle',
      label: copy.status,
      type: 'checks',
      options: DISCOUNT_LIFECYCLES.map((l) => ({ value: l, label: copy.lifecycles[l] })),
      value: f.lifecycle,
      onChange: (next) =>
        onChange({ lifecycle: DISCOUNT_LIFECYCLES.filter((l) => next.includes(l)) }),
    },
    {
      key: 'type',
      label: copy.type,
      type: 'checks',
      options: DISCOUNT_TYPES.map((t) => ({ value: t, label: copy.types[t] })),
      value: f.type,
      onChange: (next) => onChange({ type: DISCOUNT_TYPES.filter((t) => next.includes(t)) }),
    },
    {
      key: 'kind',
      label: copy.method,
      type: 'checks',
      options: DISCOUNT_KINDS.map((k) => ({ value: k, label: copy.kinds[k] })),
      value: f.kind,
      onChange: (next) => onChange({ kind: DISCOUNT_KINDS.filter((k) => next.includes(k)) }),
    },
    {
      key: 'active',
      label: copy.active,
      type: 'date',
      presets: ACTIVE_FILTERS.map((p) => ({ value: p, label: copy.activeOptions[p] })),
      value: f.active,
      onChange: (active) => onChange({ active }),
      anyLabel: copy.anyDate,
    },
    {
      key: 'used',
      label: copy.used,
      type: 'range',
      input: 'number',
      from: f.usedMin,
      to: f.usedMax,
      fromLabel: copy.usedMin,
      toLabel: copy.usedMax,
      onChange: ({ from, to }) =>
        onChange({
          ...(from === undefined ? {} : { usedMin: from }),
          ...(to === undefined ? {} : { usedMax: to }),
        }),
    },
    {
      key: 'limitReached',
      label: copy.limitReached,
      type: 'boolean',
      value: f.limitReached === null ? null : f.limitReached === 'yes',
      onChange: (next) => onChange({ limitReached: next === null ? null : next ? 'yes' : 'no' }),
    },
  ]
}
