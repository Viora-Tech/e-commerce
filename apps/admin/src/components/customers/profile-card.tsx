'use client'

import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import ContactActions from '@/components/layout/contact-actions'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { customerDetailContent } from '@/data/customers'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { telUrl } from '@/lib/customer-contact'
import type { CustomerDetail } from './customer-detail-types'
import { day } from './customer-detail-types'

type ProfileCardProps = {
  customer: CustomerDetail
  onEdit: () => void
}

/** Contact details with copy buttons and one-tap WhatsApp and call. Addresses and consent have their own cards. */
export default function ProfileCard({ customer, onEdit }: ProfileCardProps) {
  // Hooks
  const copy = useCopy(customerDetailContent)
  const locale = useLocale()

  // Render logic
  const c = copy.profile
  const call = telUrl(customer.phone)

  return (
    <DataCard
      title={c.heading}
      className="rounded-xl"
      action={
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil aria-hidden="true" />
          {copy.actions.edit}
        </Button>
      }
    >
      <KeyValueList
        variant="grid"
        rows={[
          {
            label: c.email,
            value: customer.email,
            href: customer.email ? `mailto:${customer.email}` : undefined,
            copy: true,
            hidden: !customer.email,
          },
          {
            label: c.phone,
            value: customer.phone,
            href: call ?? undefined,
            copy: true,
            hidden: !customer.phone,
          },
          { label: c.created, value: day(customer.createdAt, locale), copy: true },
        ]}
      />
      <ContactActions phone={customer.phone} className="mt-3" />
    </DataCard>
  )
}
