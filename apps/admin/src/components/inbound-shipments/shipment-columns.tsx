import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { inboundShipmentsContent } from '@/data/purchasing'
import type { api } from '@/lib/api-client'

export type InboundShipmentRow = Awaited<
  ReturnType<typeof api.inboundShipments.list>
>['rows'][number]

const quiet = (text: string) => <span className="text-muted-foreground-soft">{text}</span>

/** Columns of the inbound shipment list. */
export const inboundShipmentColumns = (
  copy: typeof inboundShipmentsContent,
): ResourceColumnSpec<InboundShipmentRow>[] => [
  {
    id: 'number',
    title: copy.columns.number,
    sortValue: (r) => r.number,
    hideable: false,
    render: (r) => <span className="text-body-strong">{copy.number(r.number)}</span>,
  },
  {
    id: 'reference',
    title: copy.columns.reference,
    sortValue: (r) => r.reference ?? '',
    align: 'start',
    className: 'w-48 px-3',
    render: (r) =>
      r.reference ? <span className="truncate">{r.reference}</span> : quiet(copy.none),
  },
  {
    id: 'billOfEntry',
    title: copy.columns.billOfEntry,
    sortValue: (r) => r.billOfEntryNo ?? '',
    render: (r) =>
      r.billOfEntryNo ? <span className="tabular-nums">{r.billOfEntryNo}</span> : quiet(copy.none),
  },
  {
    id: 'port',
    title: copy.columns.port,
    sortValue: (r) => r.port ?? '',
    render: (r) => r.port ?? quiet(copy.none),
  },
  {
    id: 'status',
    align: 'center',
    title: copy.columns.status,
    sortValue: (r) => r.status,
    render: (r) => <StatusLabel kind="inboundShipment" value={r.status} />,
  },
  {
    id: 'orders',
    align: 'end',
    title: copy.columns.orders,
    sortValue: (r) => r.orders,
    render: (r) => <span className="tabular-nums">{r.orders}</span>,
  },
  {
    id: 'arrived',
    title: copy.columns.arrived,
    sortValue: (r) => (r.arrivedAt ? new Date(r.arrivedAt) : null),
    render: (r) => (r.arrivedAt ? <RelativeTime value={r.arrivedAt} /> : quiet(copy.none)),
  },
]
