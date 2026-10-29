import CustomerAvatar from '@/components/customers/customer-avatar'
import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { draftsContent } from '@/data/drafts'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

type Item = Awaited<ReturnType<typeof api.orders.listDrafts>>['items'][number]

/** The Drafts list's columns. */
export function draftColumns(
  copy: typeof draftsContent,
  fmt: Formatters,
): ResourceColumnSpec<Item>[] {
  return [
    {
      id: 'number',
      title: copy.columns.number,
      sortValue: (d) => d.number,
      hideable: false,
      className: 'w-24',
      render: (d) => <span className="font-medium tabular-nums">#{d.number}</span>,
    },
    {
      id: 'customer',
      title: copy.columns.customer,
      sortValue: (d) => d.customerName ?? d.email ?? '',
      render: (d) =>
        d.customerName || d.email ? (
          <span className="flex min-w-0 items-center gap-3">
            <CustomerAvatar
              name={d.customerName}
              email={d.email}
              className="size-6 bg-muted font-medium text-foreground"
            />
            <span className="truncate text-body text-ink-strong">{d.customerName ?? d.email}</span>
          </span>
        ) : (
          <span className="flex items-center gap-3 text-muted-foreground">
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              –
            </span>
            {copy.guest}
          </span>
        ),
    },
    {
      id: 'items',
      title: copy.columns.items,
      sortValue: (d) => d.lineCount,
      render: (d) => <span className="tabular-nums">{copy.itemCount(d.lineCount)}</span>,
    },
    {
      id: 'total',
      title: copy.columns.total,
      sortValue: (d) => d.totalPaise,
      align: 'end',
      render: (d) => <span className="font-medium tabular-nums">{fmt.money(d.totalPaise)}</span>,
    },
    {
      id: 'created',
      title: copy.columns.created,
      sortValue: (d) => new Date(d.createdAt).getTime(),
      sortLabels: { desc: copy.sortNewest, asc: copy.sortOldest },
      render: (d) => <span className="tabular-nums">{fmt.when(d.createdAt)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (d) =>
        d.invoiceSentAt ? (
          <StatusChip tone="attention">{copy.status.invoiceSent}</StatusChip>
        ) : (
          <StatusChip tone="info">{copy.status.open}</StatusChip>
        ),
    },
  ]
}
