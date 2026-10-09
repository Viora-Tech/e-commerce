'use client'

import type { CheckoutSettingsView, PaymentAdjustment } from '@commerce/core'
import type { CheckoutSettings as Settings } from '@commerce/core/checkout-settings'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SaveBar from '@/components/layout/save-bar'
import ChoiceList from '@/components/returns/choice-list'
import CheckoutBrandingSettings from '@/components/settings/checkout-branding-settings'
import CheckoutToggleRow from '@/components/settings/checkout-toggle-row'
import CodRulesCard from '@/components/settings/cod-rules-card'
import RupeeInput from '@/components/settings/rupee-input'
import SectionTabs from '@/components/settings/section-tabs'
import SettingsSection from '@/components/settings/settings-section'
import { checkoutBrandingContent, checkoutSettingsContent as copy } from '@/data/checkout-settings'
import { settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SettingsCard from './settings-card'
import SettingsPageHeader from './settings-page-header'

type Form = { settings: Settings; codFee: PaymentAdjustment | null }

type Loaded = CheckoutSettingsView & { pincodeDirectory: boolean }

const formOf = (v: Loaded): Form => ({ settings: v.settings, codFee: v.codFee })

/**
 * Settings → Checkout, in two tabs: the form (contact, address, minimum order, cash on
 * delivery rules, the last only when COD is on) and Branding (the locked checkout's look,
 * with a live preview). One save covers both.
 */
export default function CheckoutSettings() {
  // Hooks
  const brandingCopy = useCopy(checkoutBrandingContent)
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
      <SettingsPageHeader title={copy.title} subtitle={copy.subtitle} />
      {!form || !s || !loaded ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <SectionTabs tabs={[brandingCopy.tabs.form, brandingCopy.tabs.branding]}>
          <SettingsSection id={brandingCopy.tabs.form.id} className="flex flex-col gap-4">
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

            <SettingsCard id="minimum" title={copy.minimum.heading}>
              <RupeeInput
                key={`min-${codKey}`}
                id="checkout-minimum"
                label={copy.minimum.label}
                hint={copy.minimum.hint}
                paise={s.minimumOrderPaise}
                onChange={(minimumOrderPaise) => patch({ minimumOrderPaise })}
              />
            </SettingsCard>

            <CodRulesCard
              key={`cod-${codKey}`}
              codEnabled={loaded.codEnabled}
              rules={s.cod}
              fee={form.codFee}
              onRules={(cod) => patch({ cod })}
              onFee={(codFee) => setForm((f) => (f ? { ...f, codFee } : f))}
            />
          </SettingsSection>
          <SettingsSection id={brandingCopy.tabs.branding.id}>
            <CheckoutBrandingSettings
              branding={s.branding}
              gstin={s.gstin}
              orderNotes={s.orderNotes}
              storeName={loaded.storeName}
              onBranding={patchBranding}
              onGstin={(gstin) => patch({ gstin })}
              onOrderNotes={(orderNotes) => patch({ orderNotes })}
            />
          </SettingsSection>
        </SectionTabs>
      )}
    </div>
  )
}
