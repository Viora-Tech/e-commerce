import OrderChip from '@/components/orders/order-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { purchaseOrdersContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { formatPaise } from '@/lib/money'

export type PurchaseOrderRow = Awaited<ReturnType<typeof api.purchaseOrders.list>>['rows'][number]

/** Columns of the purchase order list. */
export const purchaseOrderColumns = (
  copy: typeof purchaseOrdersContent,
  fmt: Formatters,
): ResourceColumnSpec<PurchaseOrderRow>[] => [
  {
    id: 'number',
    title: copy.columns.number,
    sortValue: (r) => r.number,
    hideable: false,
    render: (r) => (
      <span className="flex min-w-0 flex-col">
        <span className="text-body-strong">{copy.number(r.number)}</span>
        {r.name ? (
          <span className="truncate text-caption text-muted-foreground">{r.name}</span>
        ) : null}
      </span>
    ),
  },
  {
    id: 'supplier',
    title: copy.columns.supplier,
    sortValue: (r) => r.supplierName,
    align: 'start',
    className: 'w-56 px-3',
    render: (r) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body text-ink-strong">{r.supplierName}</span>
        <span className="text-caption text-muted-foreground">{copy.billsIn(r.currency)}</span>
      </span>
    ),
  },
  {
    id: 'destination',
    title: copy.columns.destination,
    sortValue: (r) => r.locationName,
    className: 'max-w-48',
    render: (r) => <span className="block truncate text-muted-foreground">{r.locationName}</span>,
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (r) => r.status,
    render: (r) => <OrderChip kind="purchaseOrder" value={r.status} />,
  },
  {
    id: 'received',
    align: 'end',
    title: copy.columns.received,
    sortValue: (r) => r.receivedUnits,
    render: (r) => (
      <span className="tabular-nums">{copy.receivedOf(r.receivedUnits, r.units)}</span>
    ),
  },
  {
    id: 'total',
    align: 'end',
    title: copy.columns.total,
    sortValue: (r) => r.totalPaise,
    render: (r) => <span className="tabular-nums">{formatPaise(r.totalPaise)}</span>,
  },
  {
    id: 'expected',
    title: copy.columns.expected,
    sortValue: (r) => (r.expectedAt ? new Date(r.expectedAt) : null),
    render: (r) =>
      r.expectedAt ? (
        <span title={fmt.dateTime(r.expectedAt)}>
          {fmt.pattern(r.expectedAt, { day: 'numeric', month: 'short' })}
        </span>
      ) : (
        <span className="text-muted-foreground-soft">{copy.none}</span>
      ),
  },
]
