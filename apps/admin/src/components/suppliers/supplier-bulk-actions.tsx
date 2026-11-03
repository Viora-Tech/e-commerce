'use client'

import type { PurchaseCurrency } from '@commerce/core/inventory'
import { Pencil, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import CountrySelect from '@/components/fields/country-select'
import CurrencySelect from '@/components/landed-cost/currency-select'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import FormDialog from '@/components/layout/form-dialog'
import { bulkActionsContent } from '@/data/bulk-actions'
import { suppliersContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched, toastOutcome } from '@/lib/run-batched'

type SupplierBulkActionsProps = {
  ids: string[]
  /** After a change: clear the selection and reload. */
  onDone: () => void
}

/**
 * The suppliers list's selection bar (#1064): bulk edit the billing currency, country and payment
 * terms (only what is ticked changes), or delete the selected suppliers.
 */
export default function SupplierBulkActions({ ids, onDone }: SupplierBulkActionsProps) {
  // Hooks
  const { bulk: copy } = useCopy(suppliersContent)
  const shared = useCopy(bulkActionsContent)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [currencyOn, setCurrencyOn] = useState(false)
  const [currency, setCurrency] = useState<PurchaseCurrency>('INR')
  const [countryOn, setCountryOn] = useState(false)
  const [country, setCountry] = useState('IN')
  const [termsOn, setTermsOn] = useState(false)
  const [terms, setTerms] = useState('')

  // Event handlers
  const handleApply = async () => {
    if (!currencyOn && !countryOn && !termsOn) {
      toast.error(copy.nothing)
      return
    }
    setBusy(true)
    try {
      const n = await api.suppliers.bulkUpdate({
        ids,
        ...(currencyOn ? { currency } : {}),
        ...(countryOn ? { country } : {}),
        ...(termsOn ? { paymentTerms: terms } : {}),
      })
      toast.success(copy.updated(n))
      setEditing(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    const outcome = await runBatched(ids, (id) => api.suppliers.delete({ id }))
    toastOutcome(outcome, shared.summary)
    onDone()
  }

  // Render logic
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Pencil aria-hidden="true" />
        {copy.edit}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setDeleting(true)}>
        <Trash2 aria-hidden="true" />
        {copy.delete}
      </Button>
      <FormDialog
        open={editing}
        onOpenChange={setEditing}
        title={copy.title(ids.length)}
        description={copy.body}
        submitLabel={busy ? copy.applying : copy.apply}
        cancelLabel={copy.cancel}
        busy={busy}
        onSubmit={handleApply}
        size="md"
      >
        <FieldGroup>
          <Field>
            <FieldLabel className="flex items-center gap-2">
              <Checkbox checked={currencyOn} onCheckedChange={(v) => setCurrencyOn(v === true)} />
              {copy.currency}
            </FieldLabel>
            <CurrencySelect
              id="bulk-supplier-currency"
              value={currency}
              className="w-full"
              disabled={!currencyOn}
              onChange={setCurrency}
            />
          </Field>
          <Field>
            <FieldLabel className="flex items-center gap-2">
              <Checkbox checked={countryOn} onCheckedChange={(v) => setCountryOn(v === true)} />
              {copy.country}
            </FieldLabel>
            <CountrySelect
              id="bulk-supplier-country"
              value={country}
              disabled={!countryOn}
              onChange={setCountry}
            />
          </Field>
          <Field>
            <FieldLabel className="flex items-center gap-2">
              <Checkbox checked={termsOn} onCheckedChange={(v) => setTermsOn(v === true)} />
              {copy.paymentTerms}
            </FieldLabel>
            <Input
              aria-label={copy.paymentTerms}
              value={terms}
              disabled={!termsOn}
              onChange={(e) => setTerms(e.target.value)}
            />
            <FieldDescription>{copy.paymentTermsHint}</FieldDescription>
          </Field>
        </FieldGroup>
      </FormDialog>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.confirmDelete.title(ids.length)}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        cancelLabel={copy.confirmDelete.cancel}
        onConfirm={handleDelete}
      />
    </>
  )
}
