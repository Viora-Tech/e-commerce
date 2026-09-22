'use client'

import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import { customerDetailContent as copy } from '@/data/customers'
import { api } from '@/lib/api-client'
import type { CustomerDetail } from './customer-detail-types'
import { day } from './customer-detail-types'

type ProfileCardProps = {
  customer: CustomerDetail
  onChanged: () => void
}

type ContactRowProps = { label: string; value: string | null; what: string; href?: string }

function ContactRow({ label, value, what, href }: ContactRowProps) {
  if (!value) return null
  return (
    <div className="group/row flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="text-caption text-muted-foreground-soft">{label}</p>
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

/** Contact details, the default address and the marketing toggle, saved as it changes. */
export default function ProfileCard({ customer, onChanged }: ProfileCardProps) {
  // Hooks
  const [marketing, setMarketing] = useState(customer.acceptsMarketing)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleMarketing = async (next: boolean) => {
    setMarketing(next)
    setSaving(true)
    try {
      await api.customers.update({ id: customer.id, acceptsMarketing: next })
      toast.success(copy.profile.marketingSaved)
      onChanged()
    } catch {
      setMarketing(!next)
      toast.error(copy.profile.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const a = customer.defaultAddress
  const address = a
    ? [a.name, a.line1, a.line2, `${a.city}, ${a.stateCode} ${a.pincode}`, a.phone]
        .filter(Boolean)
        .join('\n')
    : null

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
      <div className="mt-4 border-t border-border pt-4">
        <div className="group/row flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground-soft">{copy.profile.address}</p>
            {a ? (
              <address className="mt-1 text-body not-italic">
                <p>{a.name}</p>
                <p>{a.line1}</p>
                {a.line2 ? <p>{a.line2}</p> : null}
                <p>
                  {a.city}, {a.stateCode} {a.pincode}
                </p>
                {a.phone ? <p>{a.phone}</p> : null}
              </address>
            ) : (
              <p className="mt-1 text-body text-muted-foreground">{copy.profile.noAddress}</p>
            )}
          </div>
          {address ? <CopyButton value={address} what={copy.profile.address} /> : null}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
        <Label htmlFor="customer-marketing" className="text-body">
          {copy.profile.marketing}
        </Label>
        <Switch
          id="customer-marketing"
          checked={marketing}
          disabled={saving}
          onCheckedChange={handleMarketing}
        />
      </div>
      <p className="mt-4 text-caption text-muted-foreground-soft">
        {copy.profile.created} {day(customer.createdAt)}
      </p>
    </DataCard>
  )
}
