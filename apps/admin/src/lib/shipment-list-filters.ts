import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { shipmentFiltersContent } from '@/data/order-list-filters'
import { dateFilterBounds, hasDateFilter, parseAsDateFilter } from '@/lib/date-filter'
import { DAY_PRESETS, daysBackStart } from '@/lib/list-filter-groups'

/** A shipment's delivery-problem (NDR) states, as stored (`shipment.ndr_status`). */
export const NDR_FILTERS = ['none', 'pending', 'action_taken', 'resolved'] as const
export const SHIPMENT_METHOD_FILTERS = ['cod', 'prepaid'] as const
type NdrFilter = (typeof NDR_FILTERS)[number]
type MethodFilter = (typeof SHIPMENT_METHOD_FILTERS)[number]

/** The Shipments filter panel, on the booked tabs (To book lists orders, not shipments). */
export type ShipmentFilters = {
  /** A courier id (`delhivery`); null for any. */
  courier: string | null
  ndr: NdrFilter[]
  booked: DateFilterValue
  method: MethodFilter[]
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const SHIPMENT_FILTER_PARAMS = {
  courier: parseAsString,
  ndr: parseAsArrayOf(parseAsStringLiteral(NDR_FILTERS)).withDefault([]),
  booked: parseAsDateFilter(DAY_PRESETS),
  method: parseAsArrayOf(parseAsStringLiteral(SHIPMENT_METHOD_FILTERS)).withDefault([]),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_SHIPMENT_FILTERS = { courier: null, ndr: null, booked: null, method: null }

export function hasShipmentFilters(f: ShipmentFilters): boolean {
  return f.courier !== null || f.ndr.length > 0 || hasDateFilter(f.booked) || f.method.length > 0
}

/** The panel as `shipments.list` input; both payment methods ticked means no method filter. */
export function shipmentFilterInput(f: ShipmentFilters, now = new Date()) {
  const booked = dateFilterBounds(f.booked, daysBackStart, now)
  return {
    ...(f.courier ? { provider: f.courier } : {}),
    ...(f.ndr.length ? { ndrStatus: f.ndr } : {}),
    ...(booked.from ? { bookedFrom: booked.from } : {}),
    ...(booked.to ? { bookedTo: booked.to } : {}),
    ...(f.method.length === 1 && f.method[0] ? { paymentMethod: f.method[0] } : {}),
  }
}

/** Keeps the keys of `all` that were ticked, in `all`'s order. */
function pick<K extends string>(all: readonly K[], ticked: string[]): K[] {
  return all.filter((k) => ticked.includes(k))
}

/** The panel's groups; the Courier select shows only once some shipment went with a courier. */
export function shipmentFilterGroups(
  f: ShipmentFilters,
  copy: typeof shipmentFiltersContent,
  onChange: (patch: Partial<ShipmentFilters>) => void,
  couriers: readonly { id: string; label: string }[],
): FilterGroup[] {
  return [
    ...(couriers.length
      ? [
          {
            key: 'courier',
            label: copy.courier,
            type: 'select' as const,
            options: couriers.map((c) => ({ value: c.id, label: c.label })),
            value: f.courier,
            onChange: (courier: string | null) => onChange({ courier }),
            anyLabel: copy.anyCourier,
          },
        ]
      : []),
    {
      key: 'ndr',
      label: copy.ndr,
      type: 'checks',
      options: NDR_FILTERS.map((n) => ({ value: n, label: copy.ndrOptions[n] })),
      value: f.ndr,
      onChange: (next) => onChange({ ndr: pick(NDR_FILTERS, next) }),
    },
    {
      key: 'booked',
      label: copy.booked,
      type: 'date',
      presets: DAY_PRESETS.map((d) => ({ value: d, label: copy.dateOptions[d] })),
      value: f.booked,
      onChange: (booked) => onChange({ booked }),
      anyLabel: copy.anyDate,
    },
    {
      key: 'method',
      label: copy.method,
      type: 'checks',
      options: SHIPMENT_METHOD_FILTERS.map((m) => ({ value: m, label: copy.methodOptions[m] })),
      value: f.method,
      onChange: (next) => onChange({ method: pick(SHIPMENT_METHOD_FILTERS, next) }),
    },
  ]
}
