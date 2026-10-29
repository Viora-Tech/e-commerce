import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { filterPanelContent } from '@/data/filter-panel'
import {
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrderStatus,
  type purchaseOrdersContent,
} from '@/data/inventory'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'
import { dateGroup, LAST_DAYS, lastDaysStart, windowInput } from '@/lib/list-filter-parts'

/** What the Purchase orders filter panel holds; arrays are "any of", empty for no filter. */
export type PurchaseOrderFilters = {
  /** The panel's own statuses; the tab stays `?status=`. */
  statuses: PurchaseOrderStatus[]
  supplier: string[]
  /** Destination location ids. */
  location: string[]
  expected: DateFilterValue
  created: DateFilterValue
}

export const NO_PURCHASE_ORDER_FILTERS: PurchaseOrderFilters = {
  statuses: [],
  supplier: [],
  location: [],
  expected: NO_DATE_FILTER,
  created: NO_DATE_FILTER,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const PURCHASE_ORDER_FILTER_PARAMS = {
  statuses: parseAsArrayOf(parseAsStringLiteral(PURCHASE_ORDER_STATUSES)).withDefault([]),
  supplier: parseAsArrayOf(parseAsString).withDefault([]),
  location: parseAsArrayOf(parseAsString).withDefault([]),
  expected: parseAsDateFilter([]),
  created: parseAsDateFilter(LAST_DAYS),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_PURCHASE_ORDER_FILTERS = {
  statuses: null,
  supplier: null,
  location: null,
  expected: null,
  created: null,
}

export function hasPurchaseOrderFilters(f: PurchaseOrderFilters): boolean {
  return (
    f.statuses.length > 0 ||
    f.supplier.length > 0 ||
    f.location.length > 0 ||
    hasDateFilter(f.expected) ||
    hasDateFilter(f.created)
  )
}

/** The panel as `purchaseOrders.list` input. */
export function purchaseOrderFilterInput(f: PurchaseOrderFilters, now = new Date()) {
  return {
    ...(f.statuses.length ? { statuses: f.statuses } : {}),
    ...(f.supplier.length ? { supplierIds: f.supplier } : {}),
    ...(f.location.length ? { locationIds: f.location } : {}),
    ...windowInput('expected', dateFilterBounds(f.expected, lastDaysStart, now)),
    ...windowInput('created', dateFilterBounds(f.created, lastDaysStart, now)),
  }
}

type Facets = {
  suppliers: { id: string; name: string }[]
  locations: { id: string; name: string }[]
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function purchaseOrderFilterGroups(
  f: PurchaseOrderFilters,
  copy: (typeof purchaseOrdersContent)['filters'],
  statusCopy: (typeof purchaseOrdersContent)['status'],
  panel: typeof filterPanelContent,
  facets: Facets,
  onChange: (patch: Partial<PurchaseOrderFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'statuses',
      label: copy.status,
      type: 'checks',
      options: PURCHASE_ORDER_STATUSES.map((s) => ({ value: s, label: statusCopy[s] })),
      value: f.statuses,
      onChange: (next) =>
        onChange({ statuses: PURCHASE_ORDER_STATUSES.filter((s) => next.includes(s)) }),
    },
    {
      key: 'supplier',
      label: copy.supplier,
      type: 'multi',
      options: facets.suppliers.map((s) => ({ value: s.id, label: s.name })),
      value: f.supplier,
      onChange: (supplier) => onChange({ supplier }),
    },
    {
      key: 'location',
      label: copy.destination,
      type: 'multi',
      options: facets.locations.map((l) => ({ value: l.id, label: l.name })),
      value: f.location,
      onChange: (location) => onChange({ location }),
    },
    dateGroup(
      'expected',
      copy.expected,
      f.expected,
      (expected) => onChange({ expected }),
      panel,
      'customOnly',
    ),
    dateGroup('created', copy.created, f.created, (created) => onChange({ created }), panel),
  ]
}
