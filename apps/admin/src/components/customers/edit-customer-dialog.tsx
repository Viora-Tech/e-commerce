'use client'

import PhoneInput from '@commerce/ui/phone-input'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import FormDialog from '@/components/layout/form-dialog'
import { customerEmailContent } from '@/data/customer-merge'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import type { CustomerDetail } from './customer-detail-types'

type EditCustomerDialogProps = {
  customer: CustomerDetail
  open: boolean
  onClose: () => void
  onSaved: () => void
}

type Draft = { name: string; email: string; phone: string }

function draftFrom(c: CustomerDetail): Draft {
  return { name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '' }
}

/** The customer who already has the email, from the API's CONFLICT answer. */
function takenBy(err: unknown): string | null {
  const e = err as { code?: string; data?: { field?: string; existingId?: string } } | null
  return e?.code === 'CONFLICT' && e.data?.field === 'email' ? (e.data.existingId ?? null) : null
}

/**
 * Name, email and phone. An email another customer has is refused, with a link to them and the
 * hint to merge instead; addresses have their own card.
 */
export default function EditCustomerDialog({
  customer,
  open,
  onClose,
  onSaved,
}: EditCustomerDialogProps) {
  // Hooks
  const copy = useCopy(customerDetailContent)
  const emailCopy = useCopy(customerEmailContent)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(customer))
  const [saving, setSaving] = useState(false)
  const [askDiscard, setAskDiscard] = useState(false)
  const [emailTakenBy, setEmailTakenBy] = useState<string | null>(null)

  // Event handlers
  /* Escape, a click outside and Cancel all come here: edits are never dropped silently (#129). */
  const handleOpenChange = (next: boolean) => {
    if (next) return
    const before = draftFrom(customer)
    const dirty =
      draft.name !== before.name || draft.email !== before.email || draft.phone !== before.phone
    if (dirty) setAskDiscard(true)
    else onClose()
  }
  const handleDiscard = () => {
    setAskDiscard(false)
    setDraft(draftFrom(customer))
    setEmailTakenBy(null)
    onClose()
  }
  const handleSave = async () => {
    setSaving(true)
    setEmailTakenBy(null)
    const email = draft.email.trim().toLowerCase()
    try {
      await api.customers.update({
        id: customer.id,
        name: draft.name.trim() || null,
        // Only sent when it changed, so an untouched form never trips the email check.
        ...(email === (customer.email ?? '') ? {} : { email: email || null }),
        phone: draft.phone.trim() || null,
      })
      toast.success(copy.edit.saved)
      onSaved()
      onClose()
    } catch (err) {
      const other = takenBy(err)
      if (other) setEmailTakenBy(other)
      else toast.error(err instanceof Error ? err.message : copy.edit.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={copy.edit.heading}
        submitLabel={copy.edit.save}
        cancelLabel={copy.edit.cancel}
        busy={saving}
        onSubmit={handleSave}
        size="lg"
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="edit-customer-name">{copy.edit.name}</FieldLabel>
            <Input
              id="edit-customer-name"
              size="lg"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field data-invalid={Boolean(emailTakenBy)}>
            <FieldLabel htmlFor="edit-customer-email">{copy.edit.email}</FieldLabel>
            <Input
              id="edit-customer-email"
              size="lg"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(emailTakenBy) || undefined}
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            {emailTakenBy ? (
              <FieldError>
                {emailCopy.taken}{' '}
                <Link href={routes.customers.detail(emailTakenBy)} className="underline">
                  {emailCopy.openOther}
                </Link>
              </FieldError>
            ) : (
              <FieldDescription>{emailCopy.help}</FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-customer-phone">{copy.edit.phone}</FieldLabel>
            <PhoneInput
              id="edit-customer-phone"
              value={draft.phone}
              onChange={(phone) => setDraft({ ...draft, phone })}
              autoComplete="tel"
            />
          </Field>
        </FieldGroup>
      </FormDialog>
      <ConfirmDialog
        tone="destructive"
        open={askDiscard}
        onOpenChange={setAskDiscard}
        title={copy.edit.discardTitle}
        body={emailCopy.discardBody}
        confirmLabel={copy.edit.discard}
        cancelLabel={copy.edit.keepEditing}
        onConfirm={handleDiscard}
      />
    </>
  )
}
