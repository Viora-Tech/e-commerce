'use client'

import type { PurchaseCurrency } from '@commerce/core/inventory'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmActionDialog from '@/components/inventory/confirm-action-dialog'
import CurrencySelect from '@/components/landed-cost/currency-select'
import PageColumns from '@/components/layout/page-columns'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import SaveBar from '@/components/layout/save-bar'
import { supplierFormContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
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
    paymentTerms: s?.paymentTerms ?? '',
    notes: s?.notes ?? '',
  }
}

const LIST = routes.products.suppliers()

/** Add or edit a supplier: who they are, how to reach them, and the terms they sell on. */
export default function SupplierForm({ supplier }: SupplierFormProps) {
  // Hooks
  const copy = useCopy(supplierFormContent)
  const router = useRouter()
  const [d, setD] = useState<Draft>(() => draftFrom(supplier))
  const [saved, setSaved] = useState(() => JSON.stringify(draftFrom(supplier)))
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Helpers
  const patch = (next: Partial<Draft>) => setD((prev) => ({ ...prev, ...next }))

  // Event handlers
  const handleSave = async () => {
    if (d.name.trim() === '') {
      toast.error(copy.needName)
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
        paymentTerms: d.paymentTerms.trim() || undefined,
        notes: d.notes.trim() || undefined,
      })
      setSaved(JSON.stringify(d))
      toast.success(supplier ? copy.saved : copy.created)
      if (supplier) router.refresh()
      else router.replace(routes.products.supplier(id))
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
      <ProoflyPageHeader
        title={supplier ? supplier.name : copy.newTitle}
        back={{ label: copy.back, href: LIST }}
        actions={
          <>
            {supplier ? (
              <Button variant="outline" onClick={() => setDeleting(true)} disabled={busy}>
                {copy.delete}
              </Button>
            ) : null}
            <Button onClick={handleSave} disabled={busy}>
              {busy ? copy.saving : copy.save}
            </Button>
          </>
        }
      />
      <PageColumns
        main={
          <>
            <Card size="form">
              <CardHeader>
                <CardTitle>{copy.details.heading}</CardTitle>
              </CardHeader>
              <CardContent>
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
                      <Input
                        id="supplier-country"
                        value={d.country}
                        maxLength={2}
                        onChange={(e) => patch({ country: e.target.value.toUpperCase() })}
                      />
                      <FieldDescription>{copy.details.countryHint}</FieldDescription>
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
                    <Field>
                      <FieldLabel htmlFor="supplier-gstin">{copy.details.gstin}</FieldLabel>
                      <Input
                        id="supplier-gstin"
                        value={d.gstin}
                        maxLength={15}
                        onChange={(e) => patch({ gstin: e.target.value.toUpperCase() })}
                      />
                      <FieldDescription>{copy.details.gstinHint}</FieldDescription>
                    </Field>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>
            <Card size="form">
              <CardHeader>
                <CardTitle>{copy.contact.heading}</CardTitle>
              </CardHeader>
              <CardContent>
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
                      <Input
                        id="supplier-phone"
                        type="tel"
                        value={d.phone}
                        onChange={(e) => patch({ phone: e.target.value })}
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
                </FieldGroup>
              </CardContent>
            </Card>
          </>
        }
        side={
          <>
            <Card size="form">
              <CardHeader>
                <CardTitle>{copy.terms.heading}</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
            {supplier ? <SupplierOrdersCard orders={supplier.orders} /> : null}
          </>
        }
      />
      <ConfirmActionDialog
        open={deleting}
        onOpenChange={setDeleting}
        copy={copy.confirmDelete}
        destructive
        onConfirm={handleDelete}
      />
    </ProoflyPageBody>
  )
}
