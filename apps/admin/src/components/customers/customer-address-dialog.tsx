'use client'

import { Save } from '@commerce/ui/icons'
import PhoneInput from '@commerce/ui/phone-input'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { customerAddressesContent } from '@/data/customer-addresses'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { fieldErrorsOf } from '@/lib/api-errors'
import AddressFields, { type AddressValue, EMPTY_ADDRESS } from './address-fields'
import { ADDRESS_ROLES, type AddressRole, flagsFor, roleOf } from './address-roles'
import type { CustomerAddressRow } from './customer-detail-types'

type CustomerAddressDialogProps = {
  customerId: string
  /** The address being edited; null adds a new one. `id` null is the order snapshot, saved as new. */
  address: CustomerAddressRow | null
  /** What a new address is for (the card's "Add shipping/billing address" buttons). */
  initialRole?: AddressRole | null
  onClose: () => void
  onSaved: () => void
}

type Draft = {
  name: string
  phone: string
  place: AddressValue
  businessName: string
  gstin: string
  role: AddressRole | null
}

function draftFrom(a: CustomerAddressRow | null, initialRole: AddressRole | null): Draft {
  if (!a) {
    return {
      name: '',
      phone: '',
      place: EMPTY_ADDRESS,
      businessName: '',
      gstin: '',
      // A new address starts as Shipping unless the card asked for another role (#137).
      role: initialRole ?? 'shipping',
    }
  }
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
    businessName: a.businessName ?? '',
    gstin: a.gstin ?? '',
    role: a.id ? roleOf(a) : initialRole,
  }
}

/**
 * Add or change one address in the customer's book, and say what it is for: shipping, billing
 * or both. Mounted only while open.
 */
export default function CustomerAddressDialog({
  customerId,
  address,
  initialRole = null,
  onClose,
  onSaved,
}: CustomerAddressDialogProps) {
  // Hooks
  const copy = useCopy(customerAddressesContent)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(address, initialRole))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleRole = (values: string[]) => {
    const role = ADDRESS_ROLES.find((r) => r === values[0]) ?? null
    // The shipping address keeps shipping until another address takes it over.
    if (shippingLocked && role !== 'shipping' && role !== 'both') return
    setDraft({ ...draft, role })
  }

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
      businessName: draft.businessName,
      gstin: draft.gstin,
      ...flagsFor(draft.role),
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
  const shippingLocked = Boolean(address?.id && address.isDefault)
  const billsHere = draft.role === 'billing' || draft.role === 'both'
  const roleHelp = d.role.help[draft.role ?? 'none']

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{editing ? d.editTitle : d.addTitle}</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel id="customer-address-role-label">{d.role.label}</FieldLabel>
            <ToggleGroup
              aria-labelledby="customer-address-role-label"
              value={draft.role ? [draft.role] : []}
              onValueChange={handleRole}
              variant="outline"
              spacing={0}
              className="w-full"
            >
              {ADDRESS_ROLES.map((r) => (
                <ToggleGroupItem
                  key={r}
                  value={r}
                  className="flex-1"
                  disabled={shippingLocked && r === 'billing'}
                >
                  {d.role.options[r]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {/* Two lines kept for the help, so picking a role never moves the form (#137). */}
            <FieldDescription className="min-h-[2lh]">
              {shippingLocked ? `${roleHelp} ${d.role.lockedShipping}` : roleHelp}
            </FieldDescription>
          </Field>
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
          {/* Company and GSTIN matter for the bill, so they stand out when the address bills. */}
          <FieldSet
            className={
              billsHere ? 'gap-3 rounded-lg border border-border bg-muted/40 p-4' : 'gap-3'
            }
          >
            <FieldLegend variant="label" className="mb-0">
              {d.business.heading}
            </FieldLegend>
            <FieldDescription>
              {billsHere ? d.business.billingHelp : d.business.shippingHelp}
            </FieldDescription>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.businessName)}>
                <FieldLabel htmlFor="customer-address-business">{d.businessName}</FieldLabel>
                <Input
                  id="customer-address-business"
                  autoComplete="organization"
                  value={draft.businessName}
                  onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
                />
                {errors.businessName ? <FieldError>{errors.businessName}</FieldError> : null}
              </Field>
              <Field data-invalid={Boolean(errors.gstin)}>
                <FieldLabel htmlFor="customer-address-gstin">{d.gstin}</FieldLabel>
                <Input
                  id="customer-address-gstin"
                  className="font-mono uppercase"
                  maxLength={15}
                  value={draft.gstin}
                  onChange={(e) => setDraft({ ...draft, gstin: e.target.value.toUpperCase() })}
                />
                {errors.gstin ? <FieldError>{errors.gstin}</FieldError> : null}
              </Field>
            </div>
          </FieldSet>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {d.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              <Save aria-hidden="true" />
              {d.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
