'use client'

import type { StoreAffiliateSettings } from '@commerce/plugin-affiliates/settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import NumberField from '@/components/apps/affiliates/number-field'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

/** Store-wide settings: open or paused, the link window, holds and payouts, TDS. */
export default function SettingsPage() {
  // Hooks
  const { settings: copy, failed } = useCopy(affiliatesContent)
  const [form, setForm] = useState<StoreAffiliateSettings | null>(null)
  const [saved, setSaved] = useState<StoreAffiliateSettings | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.affiliates.settings.get().then((s) => {
      setForm(s)
      setSaved(s)
    })
  }, [])

  // Event handlers
  const handleChange = (patch: Partial<StoreAffiliateSettings>) =>
    setForm((f) => (f ? { ...f, ...patch } : f))
  const handleTds = (patch: Partial<StoreAffiliateSettings['tds']>) =>
    setForm((f) => (f ? { ...f, tds: { ...f.tds, ...patch } } : f))
  const handleGst = (patch: Partial<StoreAffiliateSettings['gst']>) =>
    setForm((f) => (f ? { ...f, gst: { ...f.gst, ...patch } } : f))
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      const next = await api.affiliates.settings.save(form)
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
      <SettingsCard
        title={copy.program}
        description={copy.perProgram}
        footer={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.apps.page('affiliates', 'programs')} />}
          >
            {copy.goPrograms}
          </Button>
        }
      >
        <SettingsRow label={copy.active} description={copy.activeHelp} htmlFor="aff-active">
          <Switch
            id="aff-active"
            checked={form.active}
            onCheckedChange={(active) => handleChange({ active })}
          />
        </SettingsRow>
      </SettingsCard>
      <SettingsCard title={copy.tracking}>
        <NumberField
          id="aff-cookie"
          label={copy.cookieDays}
          description={copy.cookieHelp}
          value={form.cookieDays}
          min={1}
          max={30}
          onChange={(cookieDays) =>
            handleChange({ cookieDays: Math.min(30, Math.max(1, cookieDays)) })
          }
        />
      </SettingsCard>
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
            <SettingsRow
              label={copy.tdsSection}
              description={copy.tdsSectionHelp}
              htmlFor="aff-tds-section"
            >
              <Input
                id="aff-tds-section"
                maxLength={80}
                value={form.tds.section}
                onChange={(e) => handleTds({ section: e.target.value })}
              />
            </SettingsRow>
          </>
        ) : null}
        <SettingsRow
          label={copy.panRequired}
          description={copy.panRequiredHelp}
          htmlFor="aff-pan-required"
        >
          <Switch
            id="aff-pan-required"
            checked={form.requirePanAboveThreshold}
            onCheckedChange={(requirePanAboveThreshold) =>
              handleChange({ requirePanAboveThreshold })
            }
          />
        </SettingsRow>
      </SettingsCard>
      <SettingsCard title={copy.gst} description={copy.gstHelp}>
        <SettingsRow label={copy.gstOn} htmlFor="aff-gst">
          <Switch
            id="aff-gst"
            checked={form.gst.enabled}
            onCheckedChange={(enabled) => handleGst({ enabled })}
          />
        </SettingsRow>
        {form.gst.enabled ? (
          <NumberField
            id="aff-gst-rate"
            label={copy.gstRate}
            value={form.gst.bp}
            scale={100}
            max={100}
            onChange={(bp) => handleGst({ bp: Math.min(10_000, bp) })}
          />
        ) : null}
      </SettingsCard>
    </div>
  )
}
