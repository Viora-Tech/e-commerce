import { parseAsArrayOf, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { filterPanelContent } from '@/data/filter-panel'
import {
  INBOUND_SHIPMENT_STATUSES,
  type InboundShipmentStatus,
  type inboundShipmentsContent,
} from '@/data/purchasing'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'
import {
  dateGroup,
  LAST_DAYS,
  lastDaysStart,
  windowInput,
  YES_NO,
  type YesNo,
  yesNoGroup,
  yesNoInput,
} from '@/lib/list-filter-parts'

/** What the Inbound shipments filter panel holds; arrays are "any of", empty for no filter. */
export type InboundShipmentFilters = {
  /** The panel's own statuses; the tab stays `?status=`. */
  statuses: InboundShipmentStatus[]
  expected: DateFilterValue
  arrived: DateFilterValue
  billOfEntry: YesNo | null
}

export const NO_INBOUND_SHIPMENT_FILTERS: InboundShipmentFilters = {
  statuses: [],
  expected: NO_DATE_FILTER,
  arrived: NO_DATE_FILTER,
  billOfEntry: null,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const INBOUND_SHIPMENT_FILTER_PARAMS = {
  statuses: parseAsArrayOf(parseAsStringLiteral(INBOUND_SHIPMENT_STATUSES)).withDefault([]),
  expected: parseAsDateFilter([]),
  arrived: parseAsDateFilter(LAST_DAYS),
  billOfEntry: parseAsStringLiteral(YES_NO),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_INBOUND_SHIPMENT_FILTERS = {
  statuses: null,
  expected: null,
  arrived: null,
  billOfEntry: null,
}

export function hasInboundShipmentFilters(f: InboundShipmentFilters): boolean {
  return (
    f.statuses.length > 0 ||
    hasDateFilter(f.expected) ||
    hasDateFilter(f.arrived) ||
    f.billOfEntry !== null
  )
}

/** The panel as `inboundShipments.list` input. */
export function inboundShipmentFilterInput(f: InboundShipmentFilters, now = new Date()) {
  const billOfEntry = yesNoInput(f.billOfEntry)
  return {
    ...(f.statuses.length ? { statuses: f.statuses } : {}),
    ...windowInput('expected', dateFilterBounds(f.expected, lastDaysStart, now)),
    ...windowInput('arrived', dateFilterBounds(f.arrived, lastDaysStart, now)),
    ...(billOfEntry === undefined ? {} : { hasBillOfEntry: billOfEntry }),
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function inboundShipmentFilterGroups(
  f: InboundShipmentFilters,
  copy: (typeof inboundShipmentsContent)['filters'],
  statusCopy: (typeof inboundShipmentsContent)['status'],
  panel: typeof filterPanelContent,
  onChange: (patch: Partial<InboundShipmentFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'statuses',
      label: copy.status,
      type: 'checks',
      options: INBOUND_SHIPMENT_STATUSES.map((s) => ({ value: s, label: statusCopy[s] })),
      value: f.statuses,
      onChange: (next) =>
        onChange({ statuses: INBOUND_SHIPMENT_STATUSES.filter((s) => next.includes(s)) }),
    },
    dateGroup(
      'expected',
      copy.expected,
      f.expected,
      (expected) => onChange({ expected }),
      panel,
      'customOnly',
    ),
    dateGroup('arrived', copy.arrived, f.arrived, (arrived) => onChange({ arrived }), panel),
    yesNoGroup('billOfEntry', copy.billOfEntry, f.billOfEntry, (billOfEntry) =>
      onChange({ billOfEntry }),
    ),
  ]
}
