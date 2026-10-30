'use client'

import type { CheckoutSettingsView, PaymentAdjustment, RolloutHold } from '@commerce/core'
import type { CheckoutSettings as Settings } from '@commerce/core/checkout-settings'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import ChoiceList from '@/components/returns/choice-list'
import RolloutHoldChip from '@/components/rollouts/rollout-hold-chip'
import CheckoutBrandingSettings from '@/components/settings/checkout-branding-settings'
import CheckoutToggleRow from '@/components/settings/checkout-toggle-row'
import CodRulesCard from '@/components/settings/cod-rules-card'
import RupeeInput from '@/components/settings/rupee-input'
import SettingsDrill from '@/components/settings/settings-drill'
import SettingsDrillPanel from '@/components/settings/settings-drill-panel'
import { checkoutBrandingContent, checkoutSettingsContent as copy } from '@/data/checkout-settings'
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SettingsCard from './settings-card'

type Form = { settings: Settings; codFee: PaymentAdjustment | null }

type Loaded = CheckoutSettingsView & { pincodeDirectory: boolean }

const formOf = (v: Loaded): Form => ({ settings: v.settings, codFee: v.codFee })

/**
 * Settings → Checkout, Shopify-style (#147): a short list of rows (contact, address, minimum
 * order, cash on delivery, branding), each with its current value, opening its detail in
 * place. One save covers every detail.
 */
export default function CheckoutSettings() {
  // Hooks
  const brandingCopy = useCopy(checkoutBrandingContent)
  const fmt = useFormat()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [codKey, setCodKey] = useState(0)
  const [busy, setBusy] = useState(false)
  // The rollout that will replace the branding ("In rollout: Diwali sale"), when one does.
  const [hold, setHold] = useState<RolloutHold | null>(null)

  useEffect(() => {
    // Members without Rollouts: read just see no chip.
    api.rollouts
      .holds()
      .then((h) => setHold(h.checkout))
      .catch(() => undefined)
    api.checkoutSettings.get().then((v) => {
      setLoaded(v)
      setForm(formOf(v))
      setSaved(JSON.stringify(formOf(v)))
    })
  }, [])

  // Helpers
  const patch = (p: Partial<Settings>) =>
    setForm((f) => (f ? { ...f, settings: { ...f.settings, ...p } } : f))
  const patchBranding = (p: Partial<Settings['branding']>) =>
    setForm((f) =>
      f ? { ...f, settings: { ...f.settings, branding: { ...f.settings.branding, ...p } } } : f,
    )

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
  const r = brandingCopy.rows
  const rows =
    s && loaded
      ? [
          {
            id: 'contact',
            title: r.contact,
            value: s.email === 'optional' ? r.emailOptional : r.emailRequired,
          },
          { id: 'address', title: r.address, value: s.pincodeFirst ? r.pincodeFirst : r.standard },
          {
            id: 'minimum',
            title: r.minimum,
            value: s.minimumOrderPaise > 0 ? fmt.money(s.minimumOrderPaise) : r.noMinimum,
          },
          { id: 'cod', title: r.cod, value: loaded.codEnabled ? r.codOn : r.codOff },
          { id: 'branding', title: r.branding, value: r.brandingValue },
        ]
      : []

  return (
    <div className="flex flex-col gap-4">
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
        back={SETTINGS_BACK}
        save={{ dirty, saving: busy, onSave: handleSave, label: copy.save }}
      />
      {!form || !s || !loaded ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <SettingsDrill rows={rows} backLabel={r.back}>
          <SettingsDrillPanel id="contact">
            <SettingsCard
              title={copy.contact.heading}
              description={`${copy.contact.phone}. ${copy.contact.phoneHint}`}
            >
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
            </SettingsCard>
          </SettingsDrillPanel>

          <SettingsDrillPanel id="address">
            <SettingsCard title={copy.address.heading}>
              <FieldGroup>
                <CheckoutToggleRow
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
            </SettingsCard>
          </SettingsDrillPanel>

          <SettingsDrillPanel id="minimum">
            <SettingsCard title={copy.minimum.heading}>
              <RupeeInput
                key={`min-${codKey}`}
                id="checkout-minimum"
                label={copy.minimum.label}
                hint={copy.minimum.hint}
                paise={s.minimumOrderPaise}
                onChange={(minimumOrderPaise) => patch({ minimumOrderPaise })}
              />
            </SettingsCard>
          </SettingsDrillPanel>

          <SettingsDrillPanel id="cod">
            <CodRulesCard
              key={`cod-${codKey}`}
              codEnabled={loaded.codEnabled}
              rules={s.cod}
              fee={form.codFee}
              onRules={(cod) => patch({ cod })}
              onFee={(codFee) => setForm((f) => (f ? { ...f, codFee } : f))}
            />
          </SettingsDrillPanel>
          <SettingsDrillPanel id="branding" className="flex flex-col gap-3">
            {hold ? (
              <div>
                <RolloutHoldChip hold={hold} />
              </div>
            ) : null}
            <CheckoutBrandingSettings
              branding={s.branding}
              gstin={s.gstin}
              orderNotes={s.orderNotes}
              storeName={loaded.storeName}
              onBranding={patchBranding}
              onGstin={(gstin) => patch({ gstin })}
              onOrderNotes={(orderNotes) => patch({ orderNotes })}
            />
          </SettingsDrillPanel>
        </SettingsDrill>
      )}
    </div>
  )
}
