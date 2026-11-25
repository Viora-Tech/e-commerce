'use client'

import type { LoyaltySettings } from '@commerce/core/loyalty'
import { useState } from 'react'
import { toast } from 'sonner'
import NumberRow from '@/components/apps/cod-rto/number-row'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import SettingsCard from '@/components/settings/settings-card'
import { appsContent } from '@/data/apps'
import { loyaltyContent } from '@/data/loyalty'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

/** The Loyalty points app's numbers: earn rate, extra points, expiry and the reminder. */
export default function LoyaltySettingsPage() {
  // Hooks
  const copy = useCopy(loyaltyContent)
  const apps = useCopy(appsContent)
  const [form, setForm] = useState<LoyaltySettings | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { failed, retry } = useLoad(async () => {
    const s = await api.loyalty.settings.get()
    setForm(s)
    setSaved(JSON.stringify(s))
    return s
  })

  // Helpers
  const set = (p: Partial<LoyaltySettings>) => setForm((f) => (f ? { ...f, ...p } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      const next = await api.loyalty.settings.save(form)
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.settings.saved)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (saved) setForm(JSON.parse(saved) as LoyaltySettings)
  }

  // Early returns
  if (!form && failed) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={copy.settings.title} summary={copy.settings.subtitle} />
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.settings}
          failed={failed}
          onRetry={retry}
        />
      </div>
    )
  }
  if (!form) {
    return (
      <SectionPageSkeleton
        cards={3}
        title={copy.settings.title}
        subtitle={copy.settings.subtitle}
      />
    )
  }

  // Render logic
  const s = copy.settings
  const dirty = saved !== null && JSON.stringify(form) !== saved

  return (
    <div className="flex flex-col gap-5">
      <SaveBar
        open={dirty}
        message={s.unsaved}
        saveLabel={s.save}
        discardLabel={s.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader title={s.title} summary={s.subtitle} />

      <SettingsCard title={s.earnTitle} description={s.earnDescription}>
        <NumberRow
          id="loyalty-rate"
          label={s.pointsPer100}
          description={s.pointsPer100Help}
          value={form.pointsPer100}
          min={0}
          max={100}
          onChange={(pointsPer100) => set({ pointsPer100 })}
        />
      </SettingsCard>

      <SettingsCard title={s.extrasTitle} description={s.extrasDescription}>
        <NumberRow
          id="loyalty-review"
          label={s.reviewPoints}
          description={s.reviewPointsHelp}
          value={form.reviewPoints}
          min={0}
          max={10_000}
          onChange={(reviewPoints) => set({ reviewPoints })}
        />
        <NumberRow
          id="loyalty-birthday"
          label={s.birthdayPoints}
          description={s.birthdayPointsHelp}
          value={form.birthdayPoints}
          min={0}
          max={10_000}
          onChange={(birthdayPoints) => set({ birthdayPoints })}
        />
      </SettingsCard>

      <SettingsCard title={s.expiryTitle} description={s.expiryDescription}>
        <NumberRow
          id="loyalty-expiry"
          label={s.expiryMonths}
          description={s.expiryMonthsHelp}
          value={form.expiryMonths}
          min={0}
          max={60}
          onChange={(expiryMonths) => set({ expiryMonths })}
        />
        <NumberRow
          id="loyalty-reminder"
          label={s.reminderDays}
          description={s.reminderDaysHelp}
          value={form.reminderDays}
          min={0}
          max={60}
          onChange={(reminderDays) => set({ reminderDays })}
        />
      </SettingsCard>
    </div>
  )
}
