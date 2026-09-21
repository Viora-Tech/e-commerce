'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import { DataCard } from '@/components/layout/data-card'
import { customerDetailContent as copy } from '@/data/customers'
import { api } from '@/lib/api-client'
import type { CustomerDetail } from './customer-detail-types'

type ProfileCardProps = {
  customer: CustomerDetail
  onChanged: () => void
}

type Draft = { name: string; phone: string; acceptsMarketing: boolean }

function draftFrom(c: CustomerDetail): Draft {
  return { name: c.name ?? '', phone: c.phone ?? '', acceptsMarketing: c.acceptsMarketing }
}

function isDirty(a: Draft, b: Draft): boolean {
  return a.name !== b.name || a.phone !== b.phone || a.acceptsMarketing !== b.acceptsMarketing
}

/** Contact details and the default address, edited in place (Profile Update frame 5:5480). */
export function ProfileCard({ customer, onChanged }: ProfileCardProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(customer))
  const [saving, setSaving] = useState(false)
  const a = customer.defaultAddress
  const dirty = isDirty(draft, draftFrom(customer))

  async function handleSave() {
    setSaving(true)
    try {
      await api.customers.update({
        id: customer.id,
        name: draft.name.trim() || null,
        phone: draft.phone.trim() || null,
        acceptsMarketing: draft.acceptsMarketing,
      })
      toast.success(copy.profile.saved)
      onChanged()
    } catch {
      toast.error(copy.profile.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DataCard title={copy.profile.heading}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="customer-name">{copy.profile.name}</FieldLabel>
          <Input
            size="lg"
            id="customer-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="customer-email">{copy.profile.email}</FieldLabel>
          <Input size="lg" id="customer-email" value={customer.email ?? ''} readOnly />
        </Field>
        <Field>
          <FieldLabel htmlFor="customer-phone">{copy.profile.phone}</FieldLabel>
          <Input
            size="lg"
            id="customer-phone"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            inputMode="tel"
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="customer-marketing" className="text-body">
            {copy.profile.marketing}
          </Label>
          <Switch
            id="customer-marketing"
            checked={draft.acceptsMarketing}
            onCheckedChange={(v) => setDraft({ ...draft, acceptsMarketing: v })}
          />
        </div>
      </FieldGroup>
      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-1 text-caption text-muted-foreground-soft">{copy.profile.address}</p>
        {a ? (
          <address className="text-body not-italic">
            <p>{a.name}</p>
            <p>{a.line1}</p>
            {a.line2 ? <p>{a.line2}</p> : null}
            <p>
              {a.city}, {a.stateCode} {a.pincode}
            </p>
            {a.phone ? <p>{a.phone}</p> : null}
          </address>
        ) : (
          <p className="text-body text-muted-foreground">{copy.profile.noAddress}</p>
        )}
      </div>
      {dirty ? (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {copy.profile.save}
          </Button>
        </div>
      ) : null}
    </DataCard>
  )
}
