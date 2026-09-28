'use client'

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
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import AddressFields, {
  type AddressValue,
  EMPTY_ADDRESS,
} from '@/components/customers/address-fields'
import { orderDetailContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { fieldErrorsOf } from '@/lib/api-errors'
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
}

function draftFrom(order: OrderDetail): Draft {
  const a = order.shippingAddress
  return {
    name: a?.name ?? order.customer?.name ?? '',
    email: order.email ?? '',
    phone: order.phone ?? a?.phone ?? '',
    address: a
      ? {
          line1: a.line1,
          line2: a.line2 ?? '',
          city: a.city,
          stateCode: a.stateCode,
          pincode: a.pincode,
        }
      : EMPTY_ADDRESS,
    alsoUpdateCustomer: false,
  }
}

/**
 * This order's contact and shipping address, changed without leaving the
 * order page. Billing follows shipping. The customer's saved address changes
 * only when the merchant ticks the box.
 */
export default function EditOrderContactDialog({
  order,
  open,
  onClose,
  onSaved,
}: EditOrderContactDialogProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(order))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Helpers
  const set =
    <K extends keyof Draft>(key: K) =>
    (v: Draft[K]) =>
      setDraft({ ...draft, [key]: v })

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) return
    setDraft(draftFrom(order))
    setErrors({})
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
        address: hasAddress
          ? {
              line1: draft.address.line1.trim(),
              line2: draft.address.line2.trim() || null,
              city: draft.address.city.trim(),
              stateCode: draft.address.stateCode,
              pincode: draft.address.pincode.trim(),
            }
          : null,
        alsoUpdateCustomer: canSaveToCustomer && draft.alsoUpdateCustomer,
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
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
                <Input
                  id="order-contact-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={draft.phone}
                  onChange={(e) => set('phone')(e.target.value)}
                />
                {errors.phone ? <FieldError>{errors.phone}</FieldError> : null}
              </Field>
            </div>
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
              {c.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
