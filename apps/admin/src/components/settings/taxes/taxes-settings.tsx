'use client'

import { financialYear, formatSeriesNumber } from '@commerce/invoices'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import SaveBar from '@/components/layout/save-bar'
import { settingsRowsContent } from '@/data/settings-rows'
import { taxesContent as copy } from '@/data/taxes'
import { useCopy } from '@/hooks/use-copy'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import SettingsDrill from '../settings-drill'
import SettingsDrillPanel from '../settings-drill-panel'
import ChargingCard from './charging-card'
import GstExplainer from './gst-explainer'
import NumberingCard from './numbering-card'
import RegistrationCard from './registration-card'
import { formOf, type TaxesFormState, type TaxesView, validateTaxes } from './taxes-form'

type TaxesSettingsProps = {
  /** Changes when GST numbers change: the GSTIN shown here is reloaded. */
  refreshKey: string
  /** How many GST numbers the store has, for the GST numbers row. */
  gstCount: number
  /** The GST numbers detail (businesses and registrations), owned by the page. */
  gstNumbers: ReactNode
  /** Tells the page header whether there is something to save, and how to save it. */
  onSaveState: (state: TaxesSaveState) => void
}

export type TaxesSaveState = { dirty: boolean; busy: boolean; save: () => void }

const same = (a: TaxesFormState, b: TaxesFormState) => JSON.stringify(a) === JSON.stringify(b)

/** The row whose detail holds the field a validation error is keyed by. */
function rowOfError(key: string): string {
  if (key.startsWith('numbering.')) return 'invoice-numbers'
  if (key === 'gstRatePercent' || key === 'defaultHsn') return 'charging'
  return 'registration'
}

/** A row's value, or "Needs a fix" while a field in its detail fails validation. */
function orFix(broken: Set<string>, id: string, value: string, needsFix: string): string {
  return broken.has(id) ? needsFix : value
}

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
 * The rows of Settings › Taxes & GST (#147): GST numbers, registration, how GST is charged (with
 * a short explainer), invoice numbers and e-invoicing. The form lives above the row details, so
 * one save bar covers them all and a half-made change survives going back to the list.
 */
export default function TaxesSettings({
  refreshKey,
  gstCount,
  gstNumbers,
  onSaveState,
}: TaxesSettingsProps) {
  // Hooks
  const rowsCopy = useCopy(settingsRowsContent)
  const announceSetup = useSetupNext()
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

  // Report the save state to the page header; `saveRef` always points at the latest handleSave.
  useEffect(() => {
    saveRef.current = handleSave
  })
  // biome-ignore lint/correctness/useExhaustiveDependencies: `onSaveState` is a state setter.
  useEffect(() => {
    const dirty = form !== null && view !== null && !same(form, formOf(view))
    onSaveState({ dirty, busy, save: () => saveRef.current() })
  }, [form, view, busy])

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
      void announceSetup('taxes')
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
  const dirty = form !== null && view !== null && !same(form, formOf(view))
  const errors = form && view && attempted ? validateTaxes(form, view.numbering.lowest) : {}
  const broken = new Set(Object.keys(errors).map(rowOfError))
  const t = rowsCopy.taxes
  const nextNumber = Number(form?.numbering.nextNumber ?? 0)
  const rows =
    form && view
      ? [
          { id: 'gst-numbers', title: t.gstNumbers, value: t.gstCount(gstCount) },
          {
            id: 'registration',
            title: t.registration,
            value: orFix(
              broken,
              'registration',
              form.legalName || form.gstin || t.notRegistered,
              rowsCopy.needsFix,
            ),
          },
          {
            id: 'charging',
            title: t.charging,
            value: orFix(
              broken,
              'charging',
              form.composition ? t.composition : t.rate(form.gstRatePercent, form.pricesIncludeGst),
              rowsCopy.needsFix,
            ),
          },
          {
            id: 'invoice-numbers',
            title: t.invoices,
            value: orFix(
              broken,
              'invoice-numbers',
              t.invoiceNext(
                formatSeriesNumber(
                  { pattern: form.numbering.prefix.toUpperCase(), pad: view.numbering.pad },
                  financialYear(new Date()),
                  Number.isInteger(nextNumber) && nextNumber > 0
                    ? nextNumber
                    : view.numbering.lowest,
                ),
              ),
              rowsCopy.needsFix,
            ),
          },
          { id: 'e-invoice', title: t.einvoice, value: t.einvoiceValue, disabled: true },
        ]
      : []

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
      {!form || !view ? (
        <LoadingCards />
      ) : (
        <SettingsDrill rows={rows} backLabel={t.back}>
          <SettingsDrillPanel id="gst-numbers">{gstNumbers}</SettingsDrillPanel>
          <SettingsDrillPanel id="registration">
            <RegistrationCard
              form={form}
              errors={errors}
              onPatch={patch}
              managed={view.gstinManaged}
            />
          </SettingsDrillPanel>
          <SettingsDrillPanel id="charging">
            <ChargingCard form={form} errors={errors} onPatch={patch} />
            <GstExplainer
              ratePercent={form.gstRatePercent}
              inclusive={form.pricesIncludeGst}
              composition={form.composition}
            />
          </SettingsDrillPanel>
          <SettingsDrillPanel id="invoice-numbers">
            <NumberingCard
              numbering={form.numbering}
              lowest={view.numbering.lowest}
              pad={view.numbering.pad}
              installed={view.invoicesAppInstalled}
              errors={errors}
              onChange={(numbering) => patch({ numbering })}
            />
          </SettingsDrillPanel>
        </SettingsDrill>
      )}
    </div>
  )
}
