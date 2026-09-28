'use client'

import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import { customerDetailContent as copy } from '@/data/customers'
import type { CustomerDetail } from './customer-detail-types'
import { day } from './customer-detail-types'

type ProfileCardProps = {
  customer: CustomerDetail
}

type ContactRowProps = { label: string; value: string | null; what: string; href?: string }

function ContactRow({ label, value, what, href }: ContactRowProps) {
  if (!value) return null
  return (
    <div className="group/row flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="text-eyebrow">{label}</p>
        {href ? (
          <a href={href} className="block truncate text-body underline-offset-4 hover:underline">
            {value}
          </a>
        ) : (
          <p className="truncate text-body">{value}</p>
        )}
      </div>
      <CopyButton value={value} what={what} />
    </div>
  )
}

/** Contact details. Addresses and marketing consent have their own cards. */
export default function ProfileCard({ customer }: ProfileCardProps) {
  return (
    <DataCard title={copy.profile.heading}>
      <ContactRow
        label={copy.profile.email}
        value={customer.email}
        what={copy.profile.email}
        href={customer.email ? `mailto:${customer.email}` : undefined}
      />
      <ContactRow
        label={copy.profile.phone}
        value={customer.phone}
        what={copy.profile.phone}
        href={customer.phone ? `tel:${customer.phone}` : undefined}
      />
      <p className="mt-4 text-caption text-muted-foreground">
        {copy.profile.created} {day(customer.createdAt)}
      </p>
    </DataCard>
  )
}
