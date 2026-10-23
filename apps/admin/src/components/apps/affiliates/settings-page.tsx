'use client'

import type { AffiliateSettings } from '@commerce/plugin-affiliates/settings'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import CommissionSettings from '@/components/apps/affiliates/commission-settings'
import NumberField from '@/components/apps/affiliates/number-field'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

/** The program: open or paused, approval, commission, holds and payouts, TDS, the signup page. */
export default function SettingsPage() {
  // Hooks
  const { settings: copy, failed } = useCopy(affiliatesContent)
  const [form, setForm] = useState<AffiliateSettings | null>(null)
  const [saved, setSaved] = useState<AffiliateSettings | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.affiliates.settings.get().then((s) => {
      setForm(s)
      setSaved(s)
    })
  }, [])

  // Event handlers
  const handleChange = (patch: Partial<AffiliateSettings>) =>
    setForm((f) => (f ? { ...f, ...patch } : f))
  const handleTds = (patch: Partial<AffiliateSettings['tds']>) =>
    setForm((f) => (f ? { ...f, tds: { ...f.tds, ...patch } } : f))
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      // Rates with no product or collection picked yet are left out rather than refused.
      const next = await api.affiliates.settings.save({
        ...form,
        overrides: form.overrides.filter((o) => o.id),
        tiers: form.tiers.filter((t) => t.name.trim()),
      })
      setForm(next)
      setSaved(next)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    } finally {
      setBusy(false)
    }
  }
  const handleDiscard = () => setForm(saved)

  // Early returns
  if (!form) return null

  // Render logic
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  return (
    <div className="flex flex-col gap-5">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader title={copy.title} summary={copy.subtitle} />
      <SettingsCard title={copy.program}>
        <SettingsRow label={copy.active} description={copy.activeHelp} htmlFor="aff-active">
          <Switch
            id="aff-active"
            checked={form.active}
            onCheckedChange={(active) => handleChange({ active })}
          />
        </SettingsRow>
        <SettingsRow label={copy.approval} htmlFor="aff-approval">
          <NativeSelect
            id="aff-approval"
            value={form.approval}
            onChange={(e) =>
              handleChange({ approval: e.target.value === 'auto' ? 'auto' : 'manual' })
            }
          >
            <NativeSelectOption value="manual">{copy.approvalManual}</NativeSelectOption>
            <NativeSelectOption value="auto">{copy.approvalAuto}</NativeSelectOption>
          </NativeSelect>
        </SettingsRow>
      </SettingsCard>
      <CommissionSettings form={form} onChange={handleChange} />
      <SettingsCard title={copy.payouts}>
        <NumberField
          id="aff-hold"
          label={copy.holdDays}
          description={copy.holdHelp}
          value={form.holdDays}
          max={90}
          onChange={(holdDays) => handleChange({ holdDays: Math.min(90, holdDays) })}
        />
        <NumberField
          id="aff-min"
          label={copy.minPayout}
          value={form.minPayoutPaise}
          scale={100}
          onChange={(minPayoutPaise) => handleChange({ minPayoutPaise })}
        />
      </SettingsCard>
      <SettingsCard title={copy.tds} description={copy.tdsHelp}>
        <SettingsRow label={copy.tdsOn} htmlFor="aff-tds">
          <Switch
            id="aff-tds"
            checked={form.tds.enabled}
            onCheckedChange={(enabled) => handleTds({ enabled })}
          />
        </SettingsRow>
        {form.tds.enabled ? (
          <>
            <NumberField
              id="aff-tds-rate"
              label={copy.tdsRate}
              value={form.tds.bp}
              scale={100}
              max={100}
              onChange={(bp) => handleTds({ bp: Math.min(10_000, bp) })}
            />
            <NumberField
              id="aff-tds-nopan"
              label={copy.tdsNoPan}
              value={form.tds.noPanBp}
              scale={100}
              max={100}
              onChange={(noPanBp) => handleTds({ noPanBp: Math.min(10_000, noPanBp) })}
            />
            <NumberField
              id="aff-tds-threshold"
              label={copy.tdsThreshold}
              value={form.tds.thresholdPaise}
              scale={100}
              onChange={(thresholdPaise) => handleTds({ thresholdPaise })}
            />
          </>
        ) : null}
      </SettingsCard>
      <SettingsCard title={copy.page}>
        <SettingsRow label={copy.pitch} description={copy.pitchHelp} htmlFor="aff-pitch">
          <Textarea
            id="aff-pitch"
            rows={3}
            maxLength={2000}
            value={form.pitch}
            onChange={(e) => handleChange({ pitch: e.target.value })}
          />
        </SettingsRow>
        <SettingsRow label={copy.terms} description={copy.termsHelp} htmlFor="aff-terms">
          <Textarea
            id="aff-terms"
            rows={6}
            maxLength={10_000}
            value={form.terms}
            onChange={(e) => handleChange({ terms: e.target.value })}
          />
        </SettingsRow>
      </SettingsCard>
    </div>
  )
}
