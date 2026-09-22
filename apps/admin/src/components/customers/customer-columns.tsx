import type { ResourceColumnSpec } from '@/components/table/resource-table'
import { customersContent } from '@/data/customers'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import CustomerAvatar from './customer-avatar'

export type CustomerRow = Awaited<ReturnType<typeof api.customers.list>>['items'][number]

/* Frame 5:2617 writes dates as 01-01-2025. */
const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

function formatDate(d: Date): string {
  return date.format(d).replaceAll('/', '-')
}

function location(item: CustomerRow): string {
  return [item.city, item.stateCode].filter(Boolean).join(', ')
}

/* Product-cell pattern from 5:2612: 32px picture slot, name beside it. */
function NameCell({ item }: { item: CustomerRow }) {
  return (
    <span className="flex items-center gap-3 text-left">
      <CustomerAvatar name={item.name} email={item.email} />
      <span className="line-clamp-2 text-body-strong">{item.name ?? customersContent.unnamed}</span>
    </span>
  )
}

function TagsCell({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-muted-foreground-soft">-</span>
  return (
    <span className="flex flex-wrap justify-center gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-foreground">
          {t}
        </span>
      ))}
    </span>
  )
}

/** Columns for the customer list, shared by the page and its skeleton. */
export const customerColumns: ResourceColumnSpec<CustomerRow>[] = [
  {
    id: 'name',
    title: customersContent.columns.name,
    sortValue: (c) => c.name ?? c.email ?? '',
    hideable: false,
    align: 'start',
    className: 'w-56 px-3 whitespace-normal',
    render: (c) => <NameCell item={c} />,
  },
  {
    id: 'email',
    title: customersContent.columns.email,
    sortValue: (c) => c.email ?? '',
    render: (c) => c.email ?? '-',
  },
  {
    id: 'location',
    title: customersContent.columns.location,
    sortValue: (c) => location(c),
    render: (c) => location(c) || <span className="text-muted-foreground-soft">-</span>,
  },
  {
    id: 'orders',
    title: customersContent.columns.orders,
    sortValue: (c) => c.orderCount,
    render: (c) => <span className="tabular-nums">{c.orderCount}</span>,
  },
  {
    id: 'spent',
    title: customersContent.columns.spent,
    sortValue: (c) => c.spentPaise,
    render: (c) => <span className="tabular-nums">{formatPaise(c.spentPaise)}</span>,
  },
  {
    id: 'lastOrder',
    title: customersContent.columns.lastOrder,
    sortValue: (c) => (c.lastOrderAt ? new Date(c.lastOrderAt).getTime() : 0),
    render: (c) =>
      c.lastOrderAt ? (
        <span className="tabular-nums">{formatDate(new Date(c.lastOrderAt))}</span>
      ) : (
        <span className="text-muted-foreground">{customersContent.never}</span>
      ),
  },
  {
    id: 'tags',
    title: customersContent.columns.tags,
    className: 'whitespace-normal',
    render: (c) => <TagsCell tags={c.tags} />,
  },
]
