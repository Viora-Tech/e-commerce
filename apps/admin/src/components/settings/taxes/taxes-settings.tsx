'use client'

import { ReceiptIcon } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { taxesContent as copy } from '@/data/taxes'
import { api } from '@/lib/api-client'
import ChargingCard from './charging-card'
import EinvoiceCard from './einvoice-card'
import GstExplainer from './gst-explainer'
import NumberingCard from './numbering-card'
import RegistrationCard from './registration-card'
import { formOf, type TaxesFormState, type TaxesView, validateTaxes } from './taxes-form'

function LoadingCards() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="gap-4 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ))}
    </>
  )
}

/**
 * Settings › Taxes & GST: registration, how GST is charged, invoice numbers,
 * e-invoicing status and a short explainer. One save bar for the whole page.
 */
export default function TaxesSettings() {
  // Hooks
  const [view, setView] = useState<TaxesView | null>(null)
  const [form, setForm] = useState<TaxesFormState | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  useEffect(() => {
    api.taxes
      .get()
      .then((v) => {
        if (!v) return
        setView(v)
        setForm(formOf(v))
      })
      .catch(() => toast.error(copy.loadFailed))
  }, [])

  // Helpers
  const patch = (p: Partial<TaxesFormState>) => setForm((f) => (f ? { ...f, ...p } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form || !view) return
    setAttempted(true)
    if (Object.keys(validateTaxes(form, view.numbering.lowest)).length) return
    setBusy(true)
    try {
      const next = await api.taxes.save(form)
      if (!next) throw new Error(copy.failed)
      setView(next)
      setForm(formOf(next))
      setAttempted(false)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (view) setForm(formOf(view))
    setAttempted(false)
  }

  // Render logic
  const dirty =
    form !== null && view !== null && JSON.stringify(form) !== JSON.stringify(formOf(view))
  const errors = form && view && attempted ? validateTaxes(form, view.numbering.lowest) : {}

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        icon={<ReceiptIcon aria-hidden="true" />}
      />
      {!form || !view ? (
        <LoadingCards />
      ) : (
        <>
          <RegistrationCard form={form} errors={errors} onPatch={patch} />
          <ChargingCard form={form} errors={errors} onPatch={patch} />
          <NumberingCard
            numbering={form.numbering}
            lowest={view.numbering.lowest}
            pad={view.numbering.pad}
            installed={view.invoicesAppInstalled}
            errors={errors}
            onChange={(numbering) => patch({ numbering })}
          />
          <EinvoiceCard />
          <GstExplainer
            ratePercent={form.gstRatePercent}
            inclusive={form.pricesIncludeGst}
            composition={form.composition}
          />
        </>
      )}
    </div>
  )
}
