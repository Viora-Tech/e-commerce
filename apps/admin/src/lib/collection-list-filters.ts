import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { collectionsListContent } from '@/data/collections'
import { dateFilterBounds, hasDateFilter, parseAsDateFilter } from '@/lib/date-filter'

/** Shown on the online store, or hidden (the Visibility column). */
export const VISIBILITY_FILTERS = ['active', 'draft'] as const
export const UPDATED_FILTERS = ['7d', '30d', '90d'] as const
type UpdatedFilter = (typeof UPDATED_FILTERS)[number]

const DAYS: Record<UpdatedFilter, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** The Collections filter panel. The list is loaded whole, so it filters in the browser. */
export type CollectionFilters = {
  visibility: (typeof VISIBILITY_FILTERS)[number][]
  /** "yes" has an image, "no" has none; null for either. */
  image: 'yes' | 'no' | null
  /** Whole numbers as typed; empty for no bound. */
  minProducts: string
  maxProducts: string
  updated: DateFilterValue
}

type Row = {
  status: string
  imageUrl: string | null
  productCount: number
  updatedAt: Date | string
}

export const COLLECTION_FILTER_PARAMS = {
  visibility: parseAsArrayOf(parseAsStringLiteral(VISIBILITY_FILTERS)).withDefault([]),
  image: parseAsStringLiteral(['yes', 'no'] as const),
  minProducts: parseAsString.withDefault(''),
  maxProducts: parseAsString.withDefault(''),
  updated: parseAsDateFilter(UPDATED_FILTERS),
}

export const CLEAR_COLLECTION_FILTERS = {
  visibility: null,
  image: null,
  minProducts: null,
  maxProducts: null,
  updated: null,
}

function whole(text: string): number | null {
  const n = Number.parseInt(text, 10)
  return Number.isFinite(n) ? n : null
}

function presetStart(preset: string, now: Date): Date | null {
  const updated = UPDATED_FILTERS.find((u) => u === preset)
  return updated ? new Date(now.getTime() - DAYS[updated] * 86_400_000) : null
}

/** A test for one row; build once per render, not per row. */
export function collectionMatcher(f: CollectionFilters, now = new Date()): (row: Row) => boolean {
  const min = whole(f.minProducts)
  const max = whole(f.maxProducts)
  const bounds = hasDateFilter(f.updated) ? dateFilterBounds(f.updated, presetStart, now) : {}
  const from = bounds.from ? new Date(bounds.from).getTime() : null
  const to = bounds.to ? new Date(bounds.to).getTime() : null
  return (row) => {
    if (f.visibility.length && !f.visibility.some((v) => v === row.status)) return false
    if (f.image === 'yes' && !row.imageUrl) return false
    if (f.image === 'no' && row.imageUrl) return false
    if (min !== null && row.productCount < min) return false
    if (max !== null && row.productCount > max) return false
    const updated = new Date(row.updatedAt).getTime()
    if (from !== null && updated < from) return false
    if (to !== null && updated >= to) return false
    return true
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function collectionFilterGroups(
  f: CollectionFilters,
  copy: (typeof collectionsListContent)['list'],
  onChange: (patch: Partial<CollectionFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'visibility',
      label: copy.columns.visibility,
      type: 'checks',
      options: VISIBILITY_FILTERS.map((v) => ({ value: v, label: copy.visibility[v] })),
      value: f.visibility,
      onChange: (next) =>
        onChange({ visibility: VISIBILITY_FILTERS.filter((v) => next.includes(v)) }),
    },
    {
      key: 'image',
      label: copy.filters.image,
      type: 'boolean',
      value: f.image === null ? null : f.image === 'yes',
      onChange: (next) => onChange({ image: next === null ? null : next ? 'yes' : 'no' }),
    },
    {
      key: 'products',
      label: copy.columns.products,
      type: 'range',
      input: 'number',
      from: f.minProducts,
      to: f.maxProducts,
      fromLabel: copy.filters.minProducts,
      toLabel: copy.filters.maxProducts,
      onChange: ({ from, to }) =>
        onChange({
          ...(from === undefined ? {} : { minProducts: from }),
          ...(to === undefined ? {} : { maxProducts: to }),
        }),
    },
    {
      key: 'updated',
      label: copy.columns.updated,
      type: 'date',
      presets: UPDATED_FILTERS.map((u) => ({ value: u, label: copy.filters.updatedOptions[u] })),
      value: f.updated,
      onChange: (updated) => onChange({ updated }),
      anyLabel: copy.filters.anyDate,
    },
  ]
}
