'use client'

import type { CheckoutSettingsView, PaymentAdjustment } from '@commerce/core'
import type { CheckoutSettings as Settings } from '@commerce/core/checkout-settings'
import { ShoppingCart } from '@commerce/ui/icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import ChoiceList from '@/components/returns/choice-list'
import CodRulesCard from '@/components/settings/cod-rules-card'
import RupeeInput from '@/components/settings/rupee-input'
import { checkoutSettingsContent as copy } from '@/data/checkout-settings'
import { settingsContent } from '@/data/settings'
import { api } from '@/lib/api-client'

type ToggleRowProps = {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (on: boolean) => void
}

type Form = { settings: Settings; codFee: PaymentAdjustment | null }

type Loaded = CheckoutSettingsView & { pincodeDirectory: boolean }

const formOf = (v: Loaded): Form => ({ settings: v.settings, codFee: v.codFee })

/** Settings → Checkout: one card per decision, cash on delivery rules only when COD is on. */
export default function CheckoutSettings() {
  // Hooks
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [codKey, setCodKey] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.checkoutSettings.get().then((v) => {
      setLoaded(v)
      setForm(formOf(v))
      setSaved(JSON.stringify(formOf(v)))
    })
  }, [])

  // Helpers
  const patch = (p: Partial<Settings>) =>
    setForm((f) => (f ? { ...f, settings: { ...f.settings, ...p } } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      const next = await api.checkoutSettings.save(form)
      setLoaded(next)
      setForm(formOf(next))
      setSaved(JSON.stringify(formOf(next)))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (!saved) return
    setForm(JSON.parse(saved) as Form)
    setCodKey((k) => k + 1)
  }

  // Render logic
  const dirty = form !== null && saved !== null && JSON.stringify(form) !== saved
  const s = form?.settings

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SaveBar
        open={dirty}
        message={settingsContent.general.unsaved}
        saveLabel={copy.save}
        discardLabel={settingsContent.general.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        icon={<ShoppingCart aria-hidden="true" />}
      />
      {!form || !s || !loaded ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <>
          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.contact.heading}</CardTitle>
              <CardDescription>
                {copy.contact.phone}. {copy.contact.phoneHint}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel>{copy.contact.email}</FieldLabel>
                <ChoiceList
                  name="checkout-email"
                  value={s.email}
                  onChange={(v) => patch({ email: v === 'optional' ? 'optional' : 'required' })}
                  choices={[
                    { value: 'required', ...copy.contact.emailChoices.required },
                    { value: 'optional', ...copy.contact.emailChoices.optional },
                  ]}
                />
              </Field>
            </CardContent>
          </Card>

          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.address.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <ToggleRow
                  id="checkout-pincode-first"
                  label={copy.address.pincodeFirst}
                  hint={copy.address.pincodeFirstHint}
                  checked={s.pincodeFirst}
                  onChange={(pincodeFirst) => patch({ pincodeFirst })}
                />
                {s.pincodeFirst && !loaded.pincodeDirectory ? (
                  <p className="text-caption text-muted-foreground">
                    {copy.address.directoryMissing}
                  </p>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="form" id="gstin">
            <CardHeader>
              <CardTitle>{copy.gstin.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <ToggleRow
                id="checkout-gstin"
                label={copy.gstin.toggle}
                hint={copy.gstin.hint}
                checked={s.gstin}
                onChange={(gstin) => patch({ gstin })}
              />
            </CardContent>
          </Card>

          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.notes.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <ToggleRow
                id="checkout-notes"
                label={copy.notes.toggle}
                hint={copy.notes.hint}
                checked={s.orderNotes}
                onChange={(orderNotes) => patch({ orderNotes })}
              />
            </CardContent>
          </Card>

          <Card size="form" id="minimum">
            <CardHeader>
              <CardTitle>{copy.minimum.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <RupeeInput
                key={`min-${codKey}`}
                id="checkout-minimum"
                label={copy.minimum.label}
                hint={copy.minimum.hint}
                paise={s.minimumOrderPaise}
                onChange={(minimumOrderPaise) => patch({ minimumOrderPaise })}
              />
            </CardContent>
          </Card>

          <CodRulesCard
            key={`cod-${codKey}`}
            codEnabled={loaded.codEnabled}
            rules={s.cod}
            fee={form.codFee}
            onRules={(cod) => patch({ cod })}
            onFee={(codFee) => setForm((f) => (f ? { ...f, codFee } : f))}
          />
        </>
      )}
    </div>
  )
}

/* A yes/no setting: label and hint on the left, switch on the right. */
function ToggleRow({ id, label, hint, checked, onChange }: ToggleRowProps) {
  return (
    <Field orientation="horizontal" className="items-start justify-between">
      <div className="flex flex-col gap-0.5">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{hint}</FieldDescription>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  )
}
