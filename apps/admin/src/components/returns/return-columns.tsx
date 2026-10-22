import type { ReturnReason } from '@commerce/core/returns'
import OrderChip from '@/components/orders/order-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { returnsContent } from '@/data/returns'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

type Item = Awaited<ReturnType<typeof api.returns.list>>['items'][number]

const reasonOf = (copy: typeof returnsContent, i: Item): string =>
  i.kind === 'rto'
    ? copy.rtoReason
    : i.reason
      ? (copy.reasons[i.reason as ReturnReason] ?? i.reason)
      : ''

/** The Returns table: number and kind, order, customer, reason, items, value, status, date. */
export function returnColumns(
  copy: typeof returnsContent,
  fmt: Formatters,
): ResourceColumnSpec<Item>[] {
  return [
    {
      id: 'return',
      title: copy.columns.return,
      hideable: false,
      sortValue: (r) => r.number,
      className: 'w-32',
      render: (r) => (
        <span className="flex flex-col text-left">
          <span className="font-medium text-ink-strong tabular-nums">{r.label}</span>
          <span className="text-caption text-muted-foreground">{copy.kind[r.kind]}</span>
        </span>
      ),
    },
    {
      id: 'order',
      title: copy.columns.order,
      sortValue: (r) => r.orderNumber,
      render: (r) => <span className="tabular-nums">#{r.orderNumber}</span>,
    },
    {
      id: 'customer',
      title: copy.columns.customer,
      align: 'start',
      className: 'whitespace-normal',
      render: (r) => (
        <span className="line-clamp-1">{r.customerName ?? r.email ?? copy.guest}</span>
      ),
    },
    {
      id: 'reason',
      title: copy.columns.reason,
      align: 'start',
      className: 'whitespace-normal',
      render: (r) => (
        <span className="line-clamp-1 text-muted-foreground">{reasonOf(copy, r)}</span>
      ),
    },
    {
      id: 'items',
      title: copy.columns.items,
      sortValue: (r) => r.items,
      render: (r) => <span className="tabular-nums">{copy.itemCount(r.items)}</span>,
    },
    {
      id: 'value',
      title: copy.columns.value,
      align: 'end',
      sortValue: (r) => r.valuePaise,
      render: (r) => <span className="font-medium tabular-nums">{fmt.money(r.valuePaise)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      sortValue: (r) => r.status,
      align: 'center',
      render: (r) => (
        <OrderChip
          kind="return"
          value={r.status}
          label={r.kind === 'rto' ? copy.rtoStatus[r.status] : undefined}
        />
      ),
    },
    {
      id: 'requested',
      title: copy.columns.requested,
      sortValue: (r) => new Date(r.requestedAt).getTime(),
      render: (r) => <span className="tabular-nums">{fmt.when(r.requestedAt)}</span>,
    },
  ]
}
