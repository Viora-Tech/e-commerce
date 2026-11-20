import Link from 'next/link'
import CustomerAvatar from '@/components/customers/customer-avatar'
import ContactActions from '@/components/layout/contact-actions'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { AbandonedCheckout } from './abandoned-detail-types'

type AbandonedCustomerCardProps = {
  checkout: AbandonedCheckout
}

/**
 * Figma "Abandoned checkout · Polish" › Customer: initials, the name and their orders so far
 * (linked to the orders list), email and phone, then Call and WhatsApp side by side.
 */
export default function AbandonedCustomerCard({ checkout }: AbandonedCustomerCardProps) {
  // Hooks
  const copy = useCopy(abandonedDetailContent).customer

  // Render logic
  const name = checkout.customerName || checkout.email || checkout.phone || copy.none
  const search = checkout.email ?? checkout.phone
  const rows = [
    { label: copy.email, value: checkout.email || copy.none },
    { label: copy.phone, value: checkout.phone || copy.none },
  ]

  return (
    <DataCard title={copy.heading} bodyClassName="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <CustomerAvatar
          name={checkout.customerName}
          email={checkout.email}
          className="size-8 bg-muted font-medium text-foreground"
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-ink-strong">{name}</span>
          {checkout.ordersCount > 0 && search ? (
            <Link
              href={`${routes.orders.list()}?query=${encodeURIComponent(search)}`}
              className="w-fit text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {copy.orders(checkout.ordersCount)}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">{copy.noOrders}</span>
          )}
        </div>
      </div>
      <KeyValueList rows={rows} variant="grid" />
      <ContactActions
        phone={checkout.phone}
        layout="grid"
        chat={{ target: { kind: 'checkout', id: checkout.id } }}
      />
    </DataCard>
  )
}
