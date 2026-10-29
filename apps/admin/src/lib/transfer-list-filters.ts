import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { filterPanelContent } from '@/data/filter-panel'
import { TRANSFER_STATUSES, type TransferStatus, type transfersContent } from '@/data/inventory'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'
import { dateGroup, LAST_DAYS, lastDaysStart, windowInput } from '@/lib/list-filter-parts'

/** What the Transfers filter panel holds; arrays are "any of", empty for no filter. */
export type TransferFilters = {
  /** The panel's own statuses; the tab stays `?status=`. */
  statuses: TransferStatus[]
  /** Origin and destination location ids. */
  origin: string[]
  destination: string[]
  created: DateFilterValue
  received: DateFilterValue
}

export const NO_TRANSFER_FILTERS: TransferFilters = {
  statuses: [],
  origin: [],
  destination: [],
  created: NO_DATE_FILTER,
  received: NO_DATE_FILTER,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const TRANSFER_FILTER_PARAMS = {
  statuses: parseAsArrayOf(parseAsStringLiteral(TRANSFER_STATUSES)).withDefault([]),
  origin: parseAsArrayOf(parseAsString).withDefault([]),
  destination: parseAsArrayOf(parseAsString).withDefault([]),
  created: parseAsDateFilter(LAST_DAYS),
  received: parseAsDateFilter(LAST_DAYS),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_TRANSFER_FILTERS = {
  statuses: null,
  origin: null,
  destination: null,
  created: null,
  received: null,
}

export function hasTransferFilters(f: TransferFilters): boolean {
  return (
    f.statuses.length > 0 ||
    f.origin.length > 0 ||
    f.destination.length > 0 ||
    hasDateFilter(f.created) ||
    hasDateFilter(f.received)
  )
}

/** The panel as `transfers.list` input. */
export function transferFilterInput(f: TransferFilters, now = new Date()) {
  return {
    ...(f.statuses.length ? { statuses: f.statuses } : {}),
    ...(f.origin.length ? { fromLocationIds: f.origin } : {}),
    ...(f.destination.length ? { toLocationIds: f.destination } : {}),
    ...windowInput('created', dateFilterBounds(f.created, lastDaysStart, now)),
    ...windowInput('received', dateFilterBounds(f.received, lastDaysStart, now)),
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function transferFilterGroups(
  f: TransferFilters,
  copy: (typeof transfersContent)['filters'],
  statusCopy: (typeof transfersContent)['status'],
  panel: typeof filterPanelContent,
  locations: { id: string; name: string }[],
  onChange: (patch: Partial<TransferFilters>) => void,
): FilterGroup[] {
  const options = locations.map((l) => ({ value: l.id, label: l.name }))
  return [
    {
      key: 'statuses',
      label: copy.status,
      type: 'checks',
      options: TRANSFER_STATUSES.map((s) => ({ value: s, label: statusCopy[s] })),
      value: f.statuses,
      onChange: (next) => onChange({ statuses: TRANSFER_STATUSES.filter((s) => next.includes(s)) }),
    },
    {
      key: 'origin',
      label: copy.origin,
      type: 'multi',
      options,
      value: f.origin,
      onChange: (origin) => onChange({ origin }),
    },
    {
      key: 'destination',
      label: copy.destination,
      type: 'multi',
      options,
      value: f.destination,
      onChange: (destination) => onChange({ destination }),
    },
    dateGroup('created', copy.created, f.created, (created) => onChange({ created }), panel),
    dateGroup('received', copy.received, f.received, (received) => onChange({ received }), panel),
  ]
}
