import StatusLabel from '@/components/status/status-label'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import { purchaseOrdersContent as copy } from '@/data/inventory'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

export type PurchaseOrderRow = Awaited<ReturnType<typeof api.purchaseOrders.list>>['rows'][number]

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** Columns of the purchase order list. */
export const purchaseOrderColumns: ResourceColumnSpec<PurchaseOrderRow>[] = [
  {
    id: 'number',
    title: copy.columns.number,
    sortValue: (r) => r.number,
    hideable: false,
    render: (r) => <span className="text-body-strong">{copy.number(r.number)}</span>,
  },
  {
    id: 'supplier',
    title: copy.columns.supplier,
    sortValue: (r) => r.supplierName,
    align: 'start',
    className: 'w-56 px-3',
    render: (r) => <span className="truncate">{r.supplierName}</span>,
  },
  {
    id: 'destination',
    title: copy.columns.destination,
    sortValue: (r) => r.locationName,
    render: (r) => r.locationName,
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (r) => r.status,
    render: (r) => <StatusLabel kind="purchaseOrder" value={r.status} variant="pill" />,
  },
  {
    id: 'received',
    title: copy.columns.received,
    sortValue: (r) => r.receivedUnits,
    render: (r) => (
      <span className="tabular-nums">{copy.receivedOf(r.receivedUnits, r.units)}</span>
    ),
  },
  {
    id: 'total',
    title: copy.columns.total,
    sortValue: (r) => r.totalPaise,
    render: (r) => <span className="tabular-nums">{formatPaise(r.totalPaise)}</span>,
  },
  {
    id: 'expected',
    title: copy.columns.expected,
    sortValue: (r) => (r.expectedAt ? new Date(r.expectedAt) : null),
    render: (r) => (r.expectedAt ? day.format(new Date(r.expectedAt)) : copy.none),
  },
]
