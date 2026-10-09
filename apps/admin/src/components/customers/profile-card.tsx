'use client'

import { Phone, WhatsappLogo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import { customerDetailContent } from '@/data/customers'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { telUrl, whatsappUrl } from '@/lib/customer-contact'
import type { CustomerDetail } from './customer-detail-types'
import { day } from './customer-detail-types'

type ProfileCardProps = {
  customer: CustomerDetail
  onEdit: () => void
}

type ContactRowProps = { label: string; value: string | null; what: string; href?: string | null }

function ContactRow({ label, value, what, href }: ContactRowProps) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-caption text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        {href ? (
          <a href={href} className="truncate text-body underline-offset-4 hover:underline">
            {value}
          </a>
        ) : (
          <span className="truncate text-body">{value}</span>
        )}
        <CopyButton value={value} what={what} visible />
      </div>
    </div>
  )
}

/** Contact details with copy buttons and one-tap WhatsApp and call. Addresses and consent have their own cards. */
export default function ProfileCard({ customer, onEdit }: ProfileCardProps) {
  // Hooks
  const copy = useCopy(customerDetailContent)
  const locale = useLocale()

  // Render logic
  const c = copy.profile
  const chat = whatsappUrl(customer.phone)
  const call = telUrl(customer.phone)

  return (
    <DataCard
      title={c.heading}
      className="rounded-xl"
      action={
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {copy.actions.edit}
        </Button>
      }
    >
      <ContactRow
        label={c.email}
        value={customer.email}
        what={c.email}
        href={customer.email ? `mailto:${customer.email}` : null}
      />
      <ContactRow label={c.phone} value={customer.phone} what={c.phone} href={call} />
      <ContactRow label={c.created} value={day(customer.createdAt, locale)} what={c.created} />
      {chat || call ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {chat ? (
            <Button
              variant="outline"
              size="sm"
              render={<a href={chat} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <WhatsappLogo />
              {copy.actions.whatsapp}
            </Button>
          ) : null}
          {call ? (
            <Button variant="outline" size="sm" render={<a href={call} />} nativeButton={false}>
              <Phone />
              {copy.actions.call}
            </Button>
          ) : null}
        </div>
      ) : null}
    </DataCard>
  )
}
