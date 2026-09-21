'use client'

import { Card } from '@commerce/ui/shadcn/card'
import { useRouter } from 'next/navigation'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import { customerDetailContent as copy, customersContent } from '@/data/customers'
import { formatPaise } from '@/lib/money'
import CustomerAvatar from './customer-avatar'
import { averageOrderPaise, type CustomerDetail, day } from './customer-detail-types'
import CustomerNoteCard from './customer-note-card'
import CustomerOrdersCard from './customer-orders-card'
import CustomerTagsCard from './customer-tags-card'
import MessagesCard from './messages-card'
import ProfileCard from './profile-card'

type CustomerViewProps = {
  customer: CustomerDetail
}

type TotalProps = { label: string; value: string }

/* Same 6.5rem tile as the lists; four across, no delta because these are lifetime figures. */
function Total({ label, value }: TotalProps) {
  return (
    <Card className="h-[6.5rem] gap-0 rounded-lg p-4">
      <p className="text-card-title">{label}</p>
      <p className="mt-3 text-stat text-ink-strong tabular-nums">{value}</p>
    </Card>
  )
}

export default function CustomerView({ customer }: CustomerViewProps) {
  // Hooks
  const router = useRouter()

  // Helpers
  const refresh = () => router.refresh()

  // Render logic
  const { totals } = customer
  const title = customer.name ?? customer.email ?? customersContent.unnamed

  return (
    <PageBody className="gap-6">
      <PageHeader
        title={title}
        subtitle={copy.since(day(customer.createdAt))}
        breadcrumbs={[{ label: copy.back, href: '/customers' }, { label: title }]}
        actions={
          <CustomerAvatar name={customer.name} email={customer.email} className="size-10 text-sm" />
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Total label={copy.totals.orders} value={String(totals.orderCount)} />
        <Total label={copy.totals.spent} value={formatPaise(totals.spentPaise)} />
        <Total
          label={copy.totals.average}
          value={formatPaise(averageOrderPaise(customer.orders))}
        />
        <Total
          label={copy.totals.lastOrder}
          value={totals.lastOrderAt ? day(totals.lastOrderAt) : customersContent.never}
        />
      </div>
      <PageColumns
        main={
          <>
            <CustomerOrdersCard orders={customer.orders} />
            <MessagesCard messages={customer.notifications} />
          </>
        }
        side={
          <>
            <ProfileCard customer={customer} onChanged={refresh} />
            <CustomerTagsCard customerId={customer.id} tags={customer.tags} onChanged={refresh} />
            <CustomerNoteCard customerId={customer.id} note={customer.note} onChanged={refresh} />
          </>
        }
      />
    </PageBody>
  )
}
