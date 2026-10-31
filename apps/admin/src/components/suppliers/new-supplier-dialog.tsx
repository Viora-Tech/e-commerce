'use client'

import type { PurchaseCurrency } from '@commerce/core/inventory'
import PhoneInput from '@commerce/ui/phone-input'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import CountrySelect from '@/components/fields/country-select'
import CurrencySelect from '@/components/landed-cost/currency-select'
import FormDialog from '@/components/layout/form-dialog'
import { supplierFormContent, supplierPickerContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type PickedSupplier = {
  id: string
  name: string
  email: string | null
  phone: string | null
  currency: string
}

type NewSupplierDialogProps = {
  open: boolean
  /** What was typed in the search box, as a starting name. */
  initialName: string
  /** Contact typed on the purchase order, kept when it is saved as a supplier (audit #157). */
  initialEmail?: string | undefined
  initialPhone?: string | undefined
  onOpenChange: (open: boolean) => void
  onCreated: (supplier: PickedSupplier) => void
}

/** The few fields a purchase order needs; the rest can be filled in under Suppliers. */
export default function NewSupplierDialog({
  open,
  initialName,
  initialEmail = '',
  initialPhone = '',
  onOpenChange,
  onCreated,
}: NewSupplierDialogProps) {
  // Hooks
  const copy = useCopy(supplierPickerContent)
  const fields = useCopy(supplierFormContent)
  const [name, setName] = useState(initialName)
  const [country, setCountry] = useState('IN')
  const [currency, setCurrency] = useState<PurchaseCurrency>('INR')
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleCreate = async () => {
    if (name.trim() === '') {
      toast.error(fields.needName)
      return
    }
    setBusy(true)
    try {
      const id = await api.suppliers.save({
        name: name.trim(),
        country: country.trim() || 'IN',
        currency,
        email: email.trim(),
        phone: phone.trim() || undefined,
      })
      onCreated({
        id,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        currency,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.newTitle}
      description={copy.newBody}
      submitLabel={busy ? copy.creating : copy.create}
      cancelLabel={copy.cancel}
      busy={busy}
      onSubmit={handleCreate}
      size="md"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-supplier-name">{fields.details.name}</FieldLabel>
          <Input id="new-supplier-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="new-supplier-country">{fields.details.country}</FieldLabel>
            <CountrySelect id="new-supplier-country" value={country} onChange={setCountry} />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-supplier-currency">{fields.details.currency}</FieldLabel>
            <CurrencySelect
              id="new-supplier-currency"
              value={currency}
              onChange={setCurrency}
              className="w-full"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="new-supplier-email">{fields.contact.email}</FieldLabel>
            <Input
              id="new-supplier-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-supplier-phone">{fields.contact.phone}</FieldLabel>
            <PhoneInput
              id="new-supplier-phone"
              value={phone}
              onChange={setPhone}
              autoComplete="tel"
            />
          </Field>
        </div>
      </FieldGroup>
    </FormDialog>
  )
}
