import type { ResourceColumnSpec } from '@/components/table/resource-table'
import { customerActivity, type customersContent } from '@/data/customers'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { phoneForDisplay } from '@/lib/phone-display'
import CustomerAvatar from './customer-avatar'
import CustomerStatusChip from './customer-status-chip'

export type CustomerRow = Awaited<ReturnType<typeof api.customers.list>>['items'][number]

type CustomerColumnCopy = typeof customersContent

export function displayName(item: CustomerRow, copy: CustomerColumnCopy): string {
  return item.name ?? item.email ?? copy.unnamed
}

/* Avatar + name, the email muted beneath: the row's one point of contact. */
function NameCell({ item, copy }: { item: CustomerRow; copy: CustomerColumnCopy }) {
  const name = displayName(item, copy)
  return (
    <span className="flex items-center gap-3 text-left">
      <CustomerAvatar name={item.name} email={item.email} />
      <span className="min-w-0">
        <span className="line-clamp-1 text-body font-medium text-foreground">{name}</span>
        {item.email && item.email !== name ? (
          <span className="line-clamp-1 text-caption text-muted-foreground">{item.email}</span>
        ) : null}
      </span>
    </span>
  )
}

/**
 * Figma "Customers / Customers list": customer, phone, orders, total spent, a centred status
 * chip; the open + ⋯ column is the table's own (`rowActions`). `copy` is the member's language.
 */
export function customerColumns(copy: CustomerColumnCopy): ResourceColumnSpec<CustomerRow>[] {
  return [
    {
      id: 'name',
      title: copy.columns.customer,
      sortValue: (c) => c.name ?? c.email ?? '',
      hideable: false,
      className: 'w-[32%] whitespace-normal',
      render: (c) => <NameCell item={c} copy={copy} />,
    },
    {
      id: 'phone',
      title: copy.columns.phone,
      sortValue: (c) => c.phone ?? '',
      render: (c) =>
        c.phone ? (
          <span className="tabular-nums">{phoneForDisplay(c.phone)}</span>
        ) : (
          <span className="text-muted-foreground-soft">-</span>
        ),
    },
    {
      id: 'orders',
      title: copy.columns.orders,
      align: 'end',
      sortValue: (c) => c.orderCount,
      render: (c) => <span className="tabular-nums">{c.orderCount}</span>,
    },
    {
      id: 'spent',
      title: copy.columns.totalSpent,
      align: 'end',
      sortValue: (c) => c.spentPaise,
      render: (c) => <span className="tabular-nums">{formatPaise(c.spentPaise)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      sortValue: (c) => customerActivity(c),
      render: (c) => <CustomerStatusChip activity={customerActivity(c)} />,
    },
  ]
}
