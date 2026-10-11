'use client'

import PhoneInput from '@commerce/ui/phone-input'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { customerAddressesContent as copy } from '@/data/customers'
import { api } from '@/lib/api-client'
import { fieldErrorsOf } from '@/lib/api-errors'
import AddressFields, { type AddressValue, EMPTY_ADDRESS } from './address-fields'
import type { CustomerAddressRow } from './customer-detail-types'

type CustomerAddressDialogProps = {
  customerId: string
  /** The address being edited; null adds a new one. `id` null is the order snapshot, saved as new. */
  address: CustomerAddressRow | null
  onClose: () => void
  onSaved: () => void
}

type Draft = { name: string; phone: string; place: AddressValue; isDefault: boolean }

function draftFrom(a: CustomerAddressRow | null): Draft {
  if (!a) return { name: '', phone: '', place: EMPTY_ADDRESS, isDefault: false }
  return {
    name: a.name,
    phone: a.phone ?? '',
    place: {
      line1: a.line1,
      line2: a.line2 ?? '',
      city: a.city,
      stateCode: a.stateCode,
      pincode: a.pincode,
    },
    isDefault: a.isDefault,
  }
}

/** Add or change one address in the customer's book. Mounted only while open. */
export default function CustomerAddressDialog({
  customerId,
  address,
  onClose,
  onSaved,
}: CustomerAddressDialogProps) {
  // Hooks
  const [draft, setDraft] = useState<Draft>(() => draftFrom(address))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const body = {
      name: draft.name,
      phone: draft.phone,
      line1: draft.place.line1,
      line2: draft.place.line2,
      city: draft.place.city,
      stateCode: draft.place.stateCode,
      pincode: draft.place.pincode,
      isDefault: draft.isDefault,
    }
    try {
      if (address?.id) {
        await api.customers.updateAddress({ customerId, addressId: address.id, address: body })
      } else {
        await api.customers.addAddress({ customerId, address: body })
      }
      toast.success(copy.dialog.saved)
      onSaved()
      onClose()
    } catch (err) {
      setErrors(fieldErrorsOf(err))
      toast.error(err instanceof Error ? err.message : copy.dialog.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const d = copy.dialog
  const editing = Boolean(address?.id)

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{editing ? d.editTitle : d.addTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="customer-address-name">{d.name}</FieldLabel>
              <Input
                id="customer-address-name"
                autoComplete="name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor="customer-address-phone">{d.phone}</FieldLabel>
              <PhoneInput
                id="customer-address-phone"
                value={draft.phone}
                onChange={(phone) => setDraft({ ...draft, phone })}
                autoComplete="tel"
              />
              {errors.phone ? <FieldError>{errors.phone}</FieldError> : null}
            </Field>
          </div>
          <AddressFields
            idPrefix="customer-address"
            value={draft.place}
            onChange={(place) => setDraft({ ...draft, place })}
            errors={errors}
          />
          {address?.isDefault ? null : (
            <Field orientation="horizontal">
              <Checkbox
                id="customer-address-default"
                checked={draft.isDefault}
                onCheckedChange={(v) => setDraft({ ...draft, isDefault: v === true })}
              />
              <FieldLabel htmlFor="customer-address-default">{copy.makeDefault}</FieldLabel>
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {d.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {d.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
