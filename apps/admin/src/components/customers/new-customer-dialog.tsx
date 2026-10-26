'use client'

import { CONSENT_CHANNELS, type ConsentChannel } from '@commerce/core/privacy'
import PhoneInput from '@commerce/ui/phone-input'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { CHANNEL_LABEL } from '@/data/customer-privacy'
import { newCustomerContent } from '@/data/new-customer'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { fieldErrorsOf } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import AddressFields, { type AddressValue, EMPTY_ADDRESS } from './address-fields'

type NewCustomerDialogProps = {
  onClose: () => void
}

type Draft = {
  name: string
  email: string
  phone: string
  withAddress: boolean
  place: AddressValue
  consent: Record<ConsentChannel, boolean>
  note: string
  tags: string
}

const EMPTY: Draft = {
  name: '',
  email: '',
  phone: '',
  withAddress: false,
  place: EMPTY_ADDRESS,
  consent: { email: false, whatsapp: false, sms: false },
  note: '',
  tags: '',
}

/** Who already has the email or mobile, from the API's CONFLICT answer. */
type Duplicate = { field: 'email' | 'phone'; existingId: string }

function duplicateOf(err: unknown): Duplicate | null {
  const e = err as { code?: string; data?: { field?: string; existingId?: string } } | null
  if (e?.code !== 'CONFLICT' || !e.data?.existingId) return null
  return { field: e.data.field === 'phone' ? 'phone' : 'email', existingId: e.data.existingId }
}

const splitTags = (raw: string) =>
  raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

/** "Add customer" on the Customers list: a centred form, then straight to the new customer. */
export default function NewCustomerDialog({ onClose }: NewCustomerDialogProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(newCustomerContent)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setDuplicate(null)
    try {
      const { id } = await api.customers.create({
        name: draft.name.trim() || undefined,
        email: draft.email.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        note: draft.note.trim() || undefined,
        tags: splitTags(draft.tags),
        consent: draft.consent,
        address: draft.withAddress
          ? {
              name: draft.name,
              phone: draft.phone,
              line1: draft.place.line1,
              line2: draft.place.line2,
              city: draft.place.city,
              stateCode: draft.place.stateCode,
              pincode: draft.place.pincode,
            }
          : undefined,
      })
      toast.success(copy.saved)
      onClose()
      router.push(routes.customers.detail(id))
    } catch (err) {
      const dup = duplicateOf(err)
      if (dup) {
        setDuplicate(dup)
        setErrors({ [dup.field]: copy.duplicate[dup.field] })
      } else {
        setErrors(fieldErrorsOf(err))
        toast.error(err instanceof Error ? err.message : copy.failed)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && !saving) onClose()
  }

  // Render logic
  const errorFor = (field: string) =>
    errors[field] ? (
      <FieldError>
        {errors[field]}{' '}
        {duplicate?.field === field ? (
          <Link
            href={routes.customers.detail(duplicate.existingId)}
            className="font-medium underline underline-offset-2"
          >
            {copy.duplicate.open}
          </Link>
        ) : null}
      </FieldError>
    ) : null

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="new-customer-name">{copy.name}</FieldLabel>
            <Input
              id="new-customer-name"
              autoComplete="off"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            {errorFor('name')}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="new-customer-email">{copy.email}</FieldLabel>
              <Input
                id="new-customer-email"
                type="email"
                autoComplete="off"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
              {errorFor('email')}
            </Field>
            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor="new-customer-phone">{copy.phone}</FieldLabel>
              <PhoneInput
                id="new-customer-phone"
                value={draft.phone}
                onChange={(phone) => setDraft({ ...draft, phone })}
                autoComplete="off"
              />
              {errorFor('phone')}
            </Field>
          </div>
          <Field orientation="horizontal">
            <Checkbox
              id="new-customer-with-address"
              checked={draft.withAddress}
              onCheckedChange={(v) => setDraft({ ...draft, withAddress: v === true })}
            />
            <FieldLabel htmlFor="new-customer-with-address">{copy.addAddress}</FieldLabel>
          </Field>
          {draft.withAddress ? (
            <div className="flex flex-col gap-3">
              <p className="text-caption text-muted-foreground">{copy.addressHelp}</p>
              <AddressFields
                idPrefix="new-customer-address"
                value={draft.place}
                onChange={(place) => setDraft({ ...draft, place })}
                errors={errors}
              />
            </div>
          ) : null}
          <FieldSet className="gap-3">
            <FieldLegend variant="label">{copy.consent}</FieldLegend>
            <FieldDescription>{copy.consentHelp}</FieldDescription>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {CONSENT_CHANNELS.map((channel) => (
                <Field key={channel} orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={`new-customer-consent-${channel}`}
                    checked={draft.consent[channel]}
                    onCheckedChange={(v) =>
                      setDraft({ ...draft, consent: { ...draft.consent, [channel]: v === true } })
                    }
                  />
                  <FieldLabel htmlFor={`new-customer-consent-${channel}`}>
                    {CHANNEL_LABEL[channel]}
                  </FieldLabel>
                </Field>
              ))}
            </div>
          </FieldSet>
          <Field data-invalid={Boolean(errors.note)}>
            <FieldLabel htmlFor="new-customer-note">{copy.note}</FieldLabel>
            <Textarea
              id="new-customer-note"
              rows={3}
              placeholder={copy.notePlaceholder}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
            {errorFor('note')}
          </Field>
          <Field>
            <FieldLabel htmlFor="new-customer-tags">{copy.tags}</FieldLabel>
            <Input
              id="new-customer-tags"
              placeholder={copy.tagsPlaceholder}
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            />
            <FieldDescription>{copy.tagsHelp}</FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              {copy.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {copy.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
