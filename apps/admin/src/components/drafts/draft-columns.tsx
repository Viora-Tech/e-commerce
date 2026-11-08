import { orderRef } from '@commerce/core/draft-number'
import CustomerAvatar from '@/components/customers/customer-avatar'
import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { draftsContent } from '@/data/drafts'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

type Item = Awaited<ReturnType<typeof api.orders.listDrafts>>['items'][number]

/** When the draft last moved: a checkout draft's last activity, else when it was made. */
const activityOf = (d: Item) => d.lastActivityAt ?? d.createdAt

/** A checkout draft's payment state, or a staff draft's invoice state. */
function statusOf(
  d: Item,
  copy: typeof draftsContent,
): { tone: 'attention' | 'info' | 'danger' | 'neutral'; label: string } {
  if (d.source !== 'checkout') {
    return d.invoiceSentAt
      ? { tone: 'attention', label: copy.status.invoiceSent }
      : { tone: 'info', label: copy.status.open }
  }
  if (d.refundNeeded) return { tone: 'danger', label: copy.status.refundNeeded }
  if (d.shopperPaid) return { tone: 'attention', label: copy.status.shopperPaid }
  if (d.expiredAt) return { tone: 'neutral', label: copy.status.expired }
  if (d.failedAttempts > 0 && d.lastAttemptStatus === 'failed') {
    return { tone: 'danger', label: copy.status.failed(d.failedAttempts) }
  }
  return { tone: 'attention', label: copy.status.unpaid }
}

/** The Drafts list's columns. */
export function draftColumns(
  copy: typeof draftsContent,
  fmt: Formatters,
): ResourceColumnSpec<Item>[] {
  return [
    {
      id: 'number',
      title: copy.columns.number,
      sortValue: (d) => d.draftNumber ?? d.number,
      hideable: false,
      className: 'w-24',
      render: (d) => <span className="font-medium tabular-nums">#{orderRef(d)}</span>,
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
      // Newest activity first (the server's order): a checkout the shopper came back to is on top.
      id: 'created',
      title: copy.columns.activity,
      sortValue: (d) => new Date(activityOf(d)).getTime(),
      sortLabels: { desc: copy.sortNewest, asc: copy.sortOldest },
      render: (d) => <span className="tabular-nums">{fmt.when(activityOf(d))}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (d) => {
        const chip = statusOf(d, copy)
        return <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      },
    },
  ]
}
