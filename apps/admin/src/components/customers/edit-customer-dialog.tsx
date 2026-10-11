'use client'

import PhoneInput from '@commerce/ui/phone-input'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import { customerDetailContent as copy } from '@/data/customers'
import { api } from '@/lib/api-client'
import type { CustomerDetail } from './customer-detail-types'

type EditCustomerDialogProps = {
  customer: CustomerDetail
  open: boolean
  onClose: () => void
  onSaved: () => void
}

type Draft = { name: string; phone: string }

function draftFrom(c: CustomerDetail): Draft {
  return { name: c.name ?? '', phone: c.phone ?? '' }
}

/** Name and phone. The email comes from their orders; addresses have their own card. */
export default function EditCustomerDialog({
  customer,
  open,
  onClose,
  onSaved,
}: EditCustomerDialogProps) {
  // Hooks
  const [draft, setDraft] = useState<Draft>(() => draftFrom(customer))
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.customers.update({
        id: customer.id,
        name: draft.name.trim() || null,
        phone: draft.phone.trim() || null,
      })
      toast.success(copy.edit.saved)
      onSaved()
      onClose()
    } catch {
      toast.error(copy.edit.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.edit.heading}</DialogTitle>
        </DialogHeader>
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
          <Field>
            <FieldLabel htmlFor="edit-customer-email">{copy.edit.email}</FieldLabel>
            <Input id="edit-customer-email" size="lg" value={customer.email ?? ''} readOnly />
            <FieldDescription>{copy.edit.emailHelp}</FieldDescription>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {copy.edit.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {copy.edit.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
