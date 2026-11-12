'use client'

import { Save } from '@commerce/ui/icons'
import PhoneInput from '@commerce/ui/phone-input'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import AddressFields, {
  type AddressValue,
  EMPTY_ADDRESS,
} from '@/components/customers/address-fields'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { orderCustomerContent } from '@/data/customer-merge'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { fieldErrorsOf } from '@/lib/api-errors'
import EmailOwnerOffer from './email-owner-offer'
import type { OrderDetail } from './order-detail-types'

type EditOrderContactDialogProps = {
  order: OrderDetail
  open: boolean
  onClose: () => void
  onSaved: () => void
}

type Draft = {
  name: string
  email: string
  phone: string
  address: AddressValue
  alsoUpdateCustomer: boolean
  /** Bill the shipping address; unticked, `billingName` at `billingAddress`. */
  billingSame: boolean
  billingName: string
  billingAddress: AddressValue
  businessName: string
  gstin: string
}

const addressValue = (a: NonNullable<OrderDetail['shippingAddress']>): AddressValue => ({
  line1: a.line1,
  line2: a.line2 ?? '',
  city: a.city,
  stateCode: a.stateCode,
  pincode: a.pincode,
})

function draftFrom(order: OrderDetail): Draft {
  const a = order.shippingAddress
  return {
    name: a?.name ?? order.customer?.name ?? '',
    email: order.email ?? '',
    phone: order.phone ?? a?.phone ?? '',
    address: a ? addressValue(a) : EMPTY_ADDRESS,
    alsoUpdateCustomer: false,
    billingSame: order.billingAddress === null,
    billingName: order.billingAddress?.name ?? '',
    billingAddress: order.billingAddress ? addressValue(order.billingAddress) : EMPTY_ADDRESS,
    businessName: order.buyerBusinessName ?? '',
    gstin: order.buyerGstin ?? '',
  }
}

/**
 * This order's contact, shipping address and billing (a separate address, the company and
 * GSTIN for the GST invoice), changed without leaving the order page. The customer's saved
 * address changes only when the merchant ticks the box.
 */
export default function EditOrderContactDialog({
  order,
  open,
  onClose,
  onSaved,
}: EditOrderContactDialogProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const moveCopy = useCopy(orderCustomerContent)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(order))
  const [moveToOwner, setMoveToOwner] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Helpers
  const set =
    <K extends keyof Draft>(key: K) =>
    (v: Draft[K]) =>
      setDraft({ ...draft, [key]: v })

  const trimmed = (a: AddressValue) => ({
    line1: a.line1.trim(),
    line2: a.line2.trim() || null,
    city: a.city.trim(),
    stateCode: a.stateCode,
    pincode: a.pincode.trim(),
  })

  // Event handlers
  const handleBillingSame = (same: boolean) => {
    // Unticking starts from the shipping address, so a different bill-to is a few edits away.
    const blank = !draft.billingName && !draft.billingAddress.line1
    setDraft({
      ...draft,
      billingSame: same,
      ...(!same && blank ? { billingName: draft.name, billingAddress: draft.address } : {}),
    })
  }

  const handleOpenChange = (next: boolean) => {
    if (next) return
    setDraft(draftFrom(order))
    setErrors({})
    setMoveToOwner(false)
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const result = await api.orders.updateContact({
        orderId: order.id,
        name: draft.name.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        address: hasAddress ? trimmed(draft.address) : null,
        alsoUpdateCustomer: canSaveToCustomer && draft.alsoUpdateCustomer,
        moveToEmailOwner: moveToOwner,
        billing: {
          address: draft.billingSame
            ? null
            : { name: draft.billingName.trim(), ...trimmed(draft.billingAddress) },
          businessName: draft.businessName.trim() || null,
          gstin: draft.gstin.trim() || null,
        },
      })
      toast.success(result.changed ? c.saved : c.unchanged)
      onSaved()
      onClose()
    } catch (err) {
      setErrors(fieldErrorsOf(err))
      toast.error(err instanceof Error ? err.message : c.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const c = copy.editContact
  const hasAddress = order.shippingAddress !== null || draft.address.line1.trim() !== ''
  const canSaveToCustomer = order.customer !== null && hasAddress
  // An imported order's GSTIN and company are the tax record it came with.
  const taxLocked = Boolean(order.importedFrom)
  const billingErrors = Object.fromEntries(
    Object.entries(errors)
      .filter(([k]) => k.startsWith('billing.'))
      .map(([k, v]) => [k.slice('billing.'.length), v]),
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{c.title}</DialogTitle>
            <DialogDescription>{c.body}</DialogDescription>
          </DialogHeader>

          <FieldSet>
            <FieldLegend>{c.contact}</FieldLegend>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="order-contact-name">{c.name}</FieldLabel>
              <Input
                id="order-contact-name"
                autoComplete="name"
                value={draft.name}
                onChange={(e) => set('name')(e.target.value)}
              />
              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="order-contact-email">{c.email}</FieldLabel>
                <Input
                  id="order-contact-email"
                  type="email"
                  autoComplete="email"
                  value={draft.email}
                  onChange={(e) => set('email')(e.target.value)}
                />
              </Field>
              <Field data-invalid={Boolean(errors.phone)}>
                <FieldLabel htmlFor="order-contact-phone">{c.phone}</FieldLabel>
                <PhoneInput
                  id="order-contact-phone"
                  value={draft.phone}
                  onChange={set('phone')}
                  autoComplete="tel"
                />
                {errors.phone ? <FieldError>{errors.phone}</FieldError> : null}
              </Field>
            </div>
            <EmailOwnerOffer
              orderId={order.id}
              email={draft.email}
              original={order.email}
              checked={moveToOwner}
              onChange={setMoveToOwner}
            />
          </FieldSet>

          <FieldSet>
            <FieldLegend>{c.shipping}</FieldLegend>
            <FieldDescription>{c.shippingHint}</FieldDescription>
            <AddressFields
              idPrefix="order-contact"
              value={draft.address}
              onChange={set('address')}
              errors={errors}
            />
          </FieldSet>

          <FieldSet>
            <FieldLegend>{c.billing}</FieldLegend>
            <Field orientation="horizontal">
              <Checkbox
                id="order-contact-billing-same"
                checked={draft.billingSame}
                onCheckedChange={(v) => handleBillingSame(v === true)}
              />
              <FieldLabel htmlFor="order-contact-billing-same">{c.billingSame}</FieldLabel>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="order-contact-business">{c.businessName}</FieldLabel>
                <Input
                  id="order-contact-business"
                  autoComplete="organization"
                  disabled={taxLocked}
                  value={draft.businessName}
                  onChange={(e) => set('businessName')(e.target.value)}
                />
              </Field>
              <Field data-invalid={Boolean(errors.gstin)}>
                <FieldLabel htmlFor="order-contact-gstin">{c.gstin}</FieldLabel>
                <Input
                  id="order-contact-gstin"
                  className="font-mono uppercase"
                  maxLength={15}
                  disabled={taxLocked}
                  aria-invalid={Boolean(errors.gstin) || undefined}
                  value={draft.gstin}
                  onChange={(e) => set('gstin')(e.target.value.toUpperCase().trim())}
                />
                {errors.gstin ? (
                  <FieldError>{errors.gstin}</FieldError>
                ) : (
                  <FieldDescription>
                    {taxLocked ? moveCopy.importedTax : c.gstinHelp}
                  </FieldDescription>
                )}
              </Field>
            </div>
            {draft.billingSame ? null : (
              <>
                <Field data-invalid={Boolean(billingErrors.name)}>
                  <FieldLabel htmlFor="order-billing-name">{c.name}</FieldLabel>
                  <Input
                    id="order-billing-name"
                    autoComplete="billing name"
                    value={draft.billingName}
                    onChange={(e) => set('billingName')(e.target.value)}
                  />
                  {billingErrors.name ? <FieldError>{billingErrors.name}</FieldError> : null}
                </Field>
                <AddressFields
                  idPrefix="order-billing"
                  value={draft.billingAddress}
                  onChange={set('billingAddress')}
                  errors={billingErrors}
                />
              </>
            )}
          </FieldSet>

          {canSaveToCustomer ? (
            <Field orientation="horizontal">
              <Checkbox
                id="order-contact-also-customer"
                checked={draft.alsoUpdateCustomer}
                onCheckedChange={(v) => set('alsoUpdateCustomer')(v === true)}
              />
              <div className="flex flex-col gap-0.5">
                <FieldLabel htmlFor="order-contact-also-customer">{c.alsoCustomer}</FieldLabel>
                <FieldDescription>{c.alsoCustomerHint}</FieldDescription>
              </div>
            </Field>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {c.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              <Save aria-hidden="true" />
              {c.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
