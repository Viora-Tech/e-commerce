import StatusLabel from '@/components/status/status-label'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import { customerActivity, customerCode, customersContent } from '@/data/customers'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import CustomerAvatar from './customer-avatar'
import CustomerRowActions from './customer-row-actions'

export type CustomerRow = Awaited<ReturnType<typeof api.customers.list>>['items'][number]

const copy = customersContent

function displayName(item: CustomerRow): string {
  return item.name ?? item.email ?? copy.unnamed
}

/* Avatar + name, the email muted beneath: the row's one point of contact. */
function NameCell({ item }: { item: CustomerRow }) {
  return (
    <span className="flex items-center gap-3 text-left">
      <CustomerAvatar name={item.name} email={item.email} />
      <span className="min-w-0">
        <span className="line-clamp-1 text-body text-foreground">{displayName(item)}</span>
        {item.email && item.email !== displayName(item) ? (
          <span className="line-clamp-1 text-caption text-muted-foreground">{item.email}</span>
        ) : null}
      </span>
    </span>
  )
}

/**
 * Frame 5:3120: seven centred columns of equal width and no thumbnails. The
 * status cell is the kit's dot label; the action cell carries the two 20px glyphs.
 */
export function customerColumns(onChanged: () => void): ResourceColumnSpec<CustomerRow>[] {
  return [
    {
      id: 'code',
      title: copy.columns.code,
      sortValue: (c) => c.createdAt.toString(),
      hideable: false,
      render: (c) => <span className="tabular-nums">{customerCode(c.id)}</span>,
    },
    {
      id: 'name',
      title: copy.columns.name,
      sortValue: (c) => c.name ?? c.email ?? '',
      hideable: false,
      className: 'whitespace-normal',
      render: (c) => <NameCell item={c} />,
    },
    {
      id: 'phone',
      title: copy.columns.phone,
      sortValue: (c) => c.phone ?? '',
      render: (c) =>
        c.phone ? (
          <span className="tabular-nums">{c.phone}</span>
        ) : (
          <span className="text-muted-foreground-soft">-</span>
        ),
    },
    {
      id: 'orders',
      title: copy.columns.orderCount,
      sortValue: (c) => c.orderCount,
      render: (c) => <span className="tabular-nums">{c.orderCount}</span>,
    },
    {
      id: 'spent',
      title: copy.columns.totalSpend,
      sortValue: (c) => c.spentPaise,
      render: (c) => <span className="tabular-nums">{formatPaise(c.spentPaise)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      sortValue: (c) => customerActivity(c),
      render: (c) => <StatusLabel kind="customer" value={customerActivity(c)} />,
    },
    {
      id: 'action',
      title: copy.columns.action,
      hideable: false,
      render: (c) => (
        <CustomerRowActions id={c.id} name={displayName(c)} email={c.email} onDeleted={onChanged} />
      ),
    },
  ]
}
