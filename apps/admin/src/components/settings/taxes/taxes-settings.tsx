'use client'

import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import SaveBar from '@/components/layout/save-bar'
import { taxesContent as copy } from '@/data/taxes'
import { api } from '@/lib/api-client'
import { useActiveSection } from '../section-tabs'
import SettingsSection from '../settings-section'
import ChargingCard from './charging-card'
import EinvoiceCard from './einvoice-card'
import GstExplainer from './gst-explainer'
import NumberingCard from './numbering-card'
import RegistrationCard from './registration-card'
import { formOf, type TaxesFormState, type TaxesView, validateTaxes } from './taxes-form'

type TaxesSettingsProps = {
  /** Changes when GST numbers change on the first tab: the GSTIN shown here is reloaded. */
  refreshKey: string
  /** The tab that holds the GST numbers; nothing of this form shows on it but the save bar. */
  gstTab: string
  /** Tells the page header whether there is something to save, and how to save it. */
  onSaveState: (state: TaxesSaveState) => void
}

export type TaxesSaveState = { dirty: boolean; busy: boolean; save: () => void }

const same = (a: TaxesFormState, b: TaxesFormState) => JSON.stringify(a) === JSON.stringify(b)

function LoadingCards() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Card key={i} gap={4} inset={6}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ))}
    </>
  )
}

/**
 * The Tax rules tab (registration, how GST is charged, a short explainer) and the Invoice numbers
 * tab (numbering, e-invoicing) of Settings › Taxes & GST. It stays mounted on every tab so one
 * save bar covers both and a half-made change survives a tab switch.
 */
export default function TaxesSettings({ refreshKey, gstTab, onSaveState }: TaxesSettingsProps) {
  // Hooks
  const active = useActiveSection()
  const [view, setView] = useState<TaxesView | null>(null)
  const [form, setForm] = useState<TaxesFormState | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const saveRef = useRef<() => void>(() => undefined)
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when GST numbers change, not on every edit.
  useEffect(() => {
    api.taxes
      .get()
      .then((v) => {
        if (!v) return
        // Keep what the member is typing; otherwise show the fresh values. `view` is the one
        // this effect's render saw, i.e. what the form was last loaded or saved from.
        setForm((f) => (f && view && !same(f, formOf(view)) ? f : formOf(v)))
        setView(v)
      })
      .catch(() => toast.error(copy.loadFailed))
  }, [refreshKey])

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

  // Report the save state to the page header; `saveRef` always points at the latest handleSave.
  const dirty = form !== null && view !== null && !same(form, formOf(view))
  useEffect(() => {
    saveRef.current = handleSave
  })
  // biome-ignore lint/correctness/useExhaustiveDependencies: report when dirty or busy change; `onSaveState` is a state setter.
  useEffect(() => {
    onSaveState({ dirty, busy, save: () => saveRef.current() })
  }, [dirty, busy])

  // Render logic
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
      {active === gstTab ? null : !form || !view ? (
        <LoadingCards />
      ) : (
        <>
          <SettingsSection id="tax-rules" className="flex flex-col gap-4">
            <RegistrationCard
              form={form}
              errors={errors}
              onPatch={patch}
              managed={view.gstinManaged}
            />
            <ChargingCard form={form} errors={errors} onPatch={patch} />
            <GstExplainer
              ratePercent={form.gstRatePercent}
              inclusive={form.pricesIncludeGst}
              composition={form.composition}
            />
          </SettingsSection>
          <SettingsSection id="invoices" className="flex flex-col gap-4">
            <NumberingCard
              numbering={form.numbering}
              lowest={view.numbering.lowest}
              pad={view.numbering.pad}
              installed={view.invoicesAppInstalled}
              errors={errors}
              onChange={(numbering) => patch({ numbering })}
            />
            <EinvoiceCard />
          </SettingsSection>
        </>
      )}
    </div>
  )
}
