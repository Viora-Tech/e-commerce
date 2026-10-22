import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { abandonedContent } from '@/data/drafts'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

type Item = Awaited<ReturnType<typeof api.orders.listAbandoned>>['items'][number]

/** Figma: amber while still open, grey once a reminder went out, green once recovered. */
const STATUS_TONE = { open: 'attention', sent: 'neutral', recovered: 'success' } as const

const statusOf = (c: Item) => (c.recovered ? 'recovered' : c.recoverySentAt ? 'sent' : 'open')

/** The abandoned checkouts table: who, what was in the cart, its value, when, and recovery. */
export function abandonedColumns(
  copy: typeof abandonedContent,
  fmt: Formatters,
): ResourceColumnSpec<Item>[] {
  return [
    {
      id: 'contact',
      title: copy.columns.contact,
      align: 'start',
      hideable: false,
      sortValue: (c) => c.email ?? c.phone ?? '',
      render: (c) => (
        <span className="block min-w-0">
          <span className="block truncate text-body-strong text-foreground">
            {c.customerName ?? c.email ?? c.phone ?? copy.anonymous}
          </span>
          {c.email ? (
            <span className="block truncate text-caption text-muted-foreground">{c.email}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'cart',
      title: copy.columns.cart,
      sortValue: (c) => c.itemCount,
      render: (c) => (
        <span className="block min-w-0">
          <span className="block truncate text-body-strong text-foreground">
            {c.firstTitle ?? copy.itemCount(c.itemCount)}
            {c.firstTitle && c.itemCount > 1 ? ` ${copy.more(c.itemCount - 1)}` : ''}
          </span>
          <span className="block text-caption text-muted-foreground">
            {copy.itemCount(c.itemCount)}
          </span>
        </span>
      ),
    },
    {
      id: 'value',
      title: copy.columns.value,
      sortValue: (c) => c.subtotalPaise,
      align: 'end',
      render: (c) => <span className="font-medium tabular-nums">{fmt.money(c.subtotalPaise)}</span>,
    },
    {
      id: 'activity',
      title: copy.columns.activity,
      sortValue: (c) => new Date(c.updatedAt).getTime(),
      render: (c) => <span className="tabular-nums">{fmt.when(c.updatedAt)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (c) => (
        <StatusChip tone={STATUS_TONE[statusOf(c)]}>{copy.status[statusOf(c)]}</StatusChip>
      ),
    },
  ]
}
