'use client'

import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import ContactActions from '@/components/layout/contact-actions'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { telUrl } from '@/lib/customer-contact'
import { phoneForDisplay } from '@/lib/phone-display'
import ContactPhonePrompt from './contact-phone-prompt'
import type { CustomerDetail } from './customer-detail-types'

type ProfileCardProps = {
  customer: CustomerDetail
  onEdit: () => void
  /** The contact phone was taken from their order; reload the customer. */
  onChanged: () => void
}

/**
 * Contact details with copy buttons and one-tap WhatsApp and call. With no phone, offers the
 * mobile from their latest order (one click) or "Add phone". Addresses and consent have their
 * own cards.
 */
export default function ProfileCard({ customer, onEdit, onChanged }: ProfileCardProps) {
  // Hooks
  const copy = useCopy(customerDetailContent)

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
            // Wraps instead of cutting the address short: the card has room (#41).
            copy: true,
            hidden: !customer.email,
          },
          {
            label: c.phone,
            value: customer.phone ? phoneForDisplay(customer.phone) : copy.contactPhone.missing,
            href: call ?? undefined,
            copy: Boolean(customer.phone),
            tone: customer.phone ? 'default' : 'muted',
          },
        ]}
      />
      {customer.phone ? (
        <ContactActions
          phone={customer.phone}
          className="mt-3"
          chat={{ target: { kind: 'customer', id: customer.id }, onOpened: onChanged }}
        />
      ) : (
        <div className="mt-3">
          <ContactPhonePrompt
            customerId={customer.id}
            suggestion={customer.phoneSuggestion}
            onAdd={onEdit}
            onSaved={onChanged}
          />
        </div>
      )}
    </DataCard>
  )
}
