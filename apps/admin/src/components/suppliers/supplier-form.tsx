'use client'

import { validateGstin } from '@commerce/core/gstin'
import type { PurchaseCurrency } from '@commerce/core/inventory'
import { Save, Store, Trash2 } from '@commerce/ui/icons'
import PhoneInput from '@commerce/ui/phone-input'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import CountrySelect from '@/components/fields/country-select'
import CurrencySelect from '@/components/landed-cost/currency-select'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import SaveBar from '@/components/layout/save-bar'
import { supplierFormContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { focusField } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import SupplierContactsField, { type ContactDraft } from './supplier-contacts-field'
import SupplierOrdersCard from './supplier-orders-card'

export type LoadedSupplier = Awaited<ReturnType<typeof api.suppliers.get>>

type SupplierFormProps = { supplier: LoadedSupplier | null }

type Draft = {
  name: string
  gstin: string
  country: string
  currency: PurchaseCurrency
  email: string
  phone: string
  address: string
  contacts: ContactDraft[]
  paymentTerms: string
  notes: string
}

function draftFrom(s: LoadedSupplier | null): Draft {
  return {
    name: s?.name ?? '',
    gstin: s?.gstin ?? '',
    country: s?.country ?? 'IN',
    currency: (s?.currency ?? 'INR') as PurchaseCurrency,
    email: s?.email ?? '',
    phone: s?.phone ?? '',
    address: s?.address ?? '',
    contacts: (s?.contacts ?? []).map((c) => ({
      kind: c.kind as ContactDraft['kind'],
      value: c.value,
      label: c.label ?? '',
    })),
    paymentTerms: s?.paymentTerms ?? '',
    notes: s?.notes ?? '',
  }
}

const LIST = routes.stock.suppliers()

/** Add or edit a supplier: who they are, how to reach them, and the terms they sell on. */
export default function SupplierForm({ supplier }: SupplierFormProps) {
  // Hooks
  const copy = useCopy(supplierFormContent)
  const router = useRouter()
  const [d, setD] = useState<Draft>(() => draftFrom(supplier))
  const [saved, setSaved] = useState(() => JSON.stringify(draftFrom(supplier)))
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [triedSave, setTriedSave] = useState(false)

  // Helpers
  const patch = (next: Partial<Draft>) => setD((prev) => ({ ...prev, ...next }))

  // Event handlers
  const handleSave = async () => {
    if (d.name.trim() === '') {
      toast.error(copy.needName)
      focusField('supplier-name')
      return
    }
    if (d.gstin.trim() !== '' && !validateGstin(d.gstin).ok) {
      setTriedSave(true)
      document.getElementById('supplier-gstin')?.focus()
      return
    }
    setBusy(true)
    try {
      const id = await api.suppliers.save({
        id: supplier?.id,
        name: d.name.trim(),
        gstin: d.gstin.trim(),
        country: d.country.trim() || 'IN',
        currency: d.currency,
        email: d.email.trim(),
        phone: d.phone.trim() || undefined,
        address: d.address.trim() || undefined,
        contacts: d.contacts
          .filter((c) => c.value.trim() !== '')
          .map((c) => ({
            kind: c.kind,
            value: c.value.trim(),
            label: c.label.trim() || undefined,
          })),
        paymentTerms: d.paymentTerms.trim() || undefined,
        notes: d.notes.trim() || undefined,
      })
      setSaved(JSON.stringify(d))
      toast.success(supplier ? copy.saved : copy.created)
      if (supplier) router.refresh()
      else router.replace(routes.stock.supplier(id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!supplier) return
    try {
      await api.suppliers.delete({ id: supplier.id })
      toast.success(copy.deleted)
      router.push(LIST)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    }
  }

  // Render logic
  // Same rules as checkout; shown once all 15 characters are in, or after a save attempt.
  const gstinCheck = d.gstin.trim() === '' ? null : validateGstin(d.gstin)
  const gstinError =
    gstinCheck && !gstinCheck.ok && (triedSave || d.gstin.trim().length === 15)
      ? copy.gstinErrors[gstinCheck.reason as keyof typeof copy.gstinErrors]
      : null
  const dirty = JSON.stringify(d) !== saved

  return (
    <ProoflyPageBody>
      <SaveBar
        open={dirty && supplier !== null}
        message={copy.unsaved}
        saveLabel={busy ? copy.saving : copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={() => setD(JSON.parse(saved) as Draft)}
        saving={busy}
      />
      <PageHeader
        title={supplier ? supplier.name : copy.newTitle}
        back={{ label: copy.back, href: LIST }}
        lead={{ kind: 'icon', node: <Store aria-hidden="true" /> }}
        summary={
          supplier
            ? [
                supplier.address,
                copy.billsIn(supplier.currency),
                copy.orderCount(supplier.orders.length),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        actions={
          <>
            {supplier ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleting(true)}
                disabled={busy}
              >
                <Trash2 aria-hidden="true" />
                {copy.delete}
              </Button>
            ) : null}
            <Button onClick={handleSave} disabled={busy}>
              <Save aria-hidden="true" />
              {busy ? copy.saving : copy.save}
            </Button>
          </>
        }
      />
      <PageColumns
        main={
          <>
            <DataCard title={copy.details.heading}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="supplier-name">{copy.details.name}</FieldLabel>
                  <Input
                    id="supplier-name"
                    size="lg"
                    value={d.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="supplier-country">{copy.details.country}</FieldLabel>
                    <CountrySelect
                      id="supplier-country"
                      value={d.country}
                      onChange={(country) => patch({ country })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="supplier-currency">{copy.details.currency}</FieldLabel>
                    <CurrencySelect
                      id="supplier-currency"
                      value={d.currency}
                      className="w-full"
                      onChange={(currency) => patch({ currency })}
                    />
                  </Field>
                  <Field data-invalid={gstinError ? true : undefined}>
                    <FieldLabel htmlFor="supplier-gstin">{copy.details.gstin}</FieldLabel>
                    <Input
                      id="supplier-gstin"
                      value={d.gstin}
                      maxLength={15}
                      aria-invalid={gstinError ? true : undefined}
                      onChange={(e) => patch({ gstin: e.target.value.toUpperCase() })}
                    />
                    {gstinError ? (
                      <FieldError>{gstinError}</FieldError>
                    ) : (
                      <FieldDescription>{copy.details.gstinHint}</FieldDescription>
                    )}
                  </Field>
                </div>
              </FieldGroup>
            </DataCard>
            <DataCard title={copy.contact.heading}>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="supplier-email">{copy.contact.email}</FieldLabel>
                    <Input
                      id="supplier-email"
                      type="email"
                      value={d.email}
                      onChange={(e) => patch({ email: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="supplier-phone">{copy.contact.phone}</FieldLabel>
                    <PhoneInput
                      id="supplier-phone"
                      value={d.phone}
                      onChange={(phone) => patch({ phone })}
                      autoComplete="tel"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="supplier-address">{copy.contact.address}</FieldLabel>
                  <Textarea
                    id="supplier-address"
                    value={d.address}
                    onChange={(e) => patch({ address: e.target.value })}
                  />
                </Field>
                <SupplierContactsField
                  contacts={d.contacts}
                  onChange={(contacts) => patch({ contacts })}
                />
              </FieldGroup>
            </DataCard>
          </>
        }
        side={
          <>
            <DataCard title={copy.terms.heading}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="supplier-terms">{copy.terms.paymentTerms}</FieldLabel>
                  <Input
                    id="supplier-terms"
                    value={d.paymentTerms}
                    placeholder={copy.terms.paymentTermsPlaceholder}
                    onChange={(e) => patch({ paymentTerms: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="supplier-notes">{copy.terms.notes}</FieldLabel>
                  <Textarea
                    id="supplier-notes"
                    value={d.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                  />
                </Field>
              </FieldGroup>
            </DataCard>
            {supplier ? <SupplierOrdersCard orders={supplier.orders} /> : null}
          </>
        }
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.confirmDelete.title}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        cancelLabel={copy.confirmDelete.cancel}
        onConfirm={handleDelete}
      />
    </ProoflyPageBody>
  )
}
