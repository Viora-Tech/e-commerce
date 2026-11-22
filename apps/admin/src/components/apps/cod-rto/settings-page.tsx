'use client'

import type { CodRtoSettings } from '@commerce/core/cod-rto'
import { useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import SwitchRow from '@/components/fields/switch-row'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import ChoiceList from '@/components/returns/choice-list'
import SettingsCard from '@/components/settings/settings-card'
import { appsContent } from '@/data/apps'
import { codRtoContent } from '@/data/cod-rto'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import NumberRow from './number-row'

type Verification = CodRtoSettings['verification']
type Risk = CodRtoSettings['risk']
type Rules = CodRtoSettings['rules']

const RUPEE = 100

/** The COD confirmation, the risk levels and the checkout rules. */
export default function SettingsPage() {
  // Hooks
  const copy = useCopy(codRtoContent)
  const apps = useCopy(appsContent)
  const [form, setForm] = useState<CodRtoSettings | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { failed, retry } = useLoad(async () => {
    const s = await api.codRto.settings.get()
    setForm(s)
    setSaved(JSON.stringify(s))
    return s
  })

  // Helpers
  const setV = (p: Partial<Verification>) =>
    setForm((f) => (f ? { ...f, verification: { ...f.verification, ...p } } : f))
  const setR = (p: Partial<Risk>) => setForm((f) => (f ? { ...f, risk: { ...f.risk, ...p } } : f))
  const setRules = (p: Partial<Rules>) =>
    setForm((f) => (f ? { ...f, rules: { ...f.rules, ...p } } : f))
  const setPartial = (p: Partial<Rules['partialPrepaid']>) =>
    setForm((f) =>
      f ? { ...f, rules: { ...f.rules, partialPrepaid: { ...f.rules.partialPrepaid, ...p } } } : f,
    )

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    if (form.risk.highAt <= form.risk.mediumAt) {
      toast.error(copy.settings.risk.thresholdError)
      return
    }
    setBusy(true)
    try {
      const next = await api.codRto.settings.save(form)
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
    if (saved) setForm(JSON.parse(saved) as CodRtoSettings)
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
  const v = form.verification
  const partial = form.rules.partialPrepaid
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

      <SettingsCard title={s.verification.title} description={s.verification.description}>
        <SwitchRow
          id="cod-verify"
          label={s.verification.enabled}
          checked={v.enabled}
          onChange={(enabled) => setV({ enabled })}
          weight="semibold"
          divided
        />
        {v.enabled ? (
          <>
            <div className="flex flex-col gap-2 py-3">
              <span className="text-body font-medium">{s.verification.sendTo}</span>
              <ChoiceList
                name="cod-send-to"
                value={v.sendTo}
                onChange={(x) => setV({ sendTo: x === 'risky' ? 'risky' : 'all' })}
                choices={[
                  { value: 'all', label: s.verification.sendToAll },
                  { value: 'risky', label: s.verification.sendToRisky },
                ]}
              />
            </div>
            <NumberRow
              id="cod-flag-after"
              label={s.verification.flagAfter}
              description={s.verification.flagAfterHelp}
              value={v.flagAfterHours}
              min={1}
              max={168}
              onChange={(flagAfterHours) => setV({ flagAfterHours })}
            />
            <SwitchRow
              id="cod-auto-cancel"
              label={s.verification.autoCancel}
              description={s.verification.autoCancelHelp}
              checked={v.autoCancel}
              onChange={(autoCancel) => setV({ autoCancel })}
              weight="semibold"
              divided
            />
            {v.autoCancel ? (
              <NumberRow
                id="cod-cancel-after"
                label={s.verification.autoCancelAfter}
                value={v.autoCancelAfterHours}
                min={1}
                max={168}
                onChange={(autoCancelAfterHours) => setV({ autoCancelAfterHours })}
              />
            ) : null}
          </>
        ) : null}
      </SettingsCard>

      <SettingsCard title={s.risk.title} description={s.risk.description}>
        <NumberRow
          id="risk-medium"
          label={s.risk.mediumAt}
          value={form.risk.mediumAt}
          min={1}
          max={99}
          onChange={(mediumAt) => setR({ mediumAt })}
        />
        <NumberRow
          id="risk-high"
          label={s.risk.highAt}
          value={form.risk.highAt}
          min={2}
          max={100}
          error={form.risk.highAt <= form.risk.mediumAt ? s.risk.thresholdError : undefined}
          onChange={(highAt) => setR({ highAt })}
        />
        <SwitchRow
          id="risk-tag"
          label={s.risk.tagOrders}
          description={s.risk.tagOrdersHelp}
          checked={form.risk.tagOrders}
          onChange={(tagOrders) => setR({ tagOrders })}
          weight="semibold"
          divided
        />
      </SettingsCard>

      <SettingsCard title={s.rules.title} description={s.rules.description}>
        <SwitchRow
          id="rule-hide-cod"
          label={s.rules.hideCod}
          description={s.rules.hideCodHelp}
          checked={form.rules.hideCodForHighRisk}
          onChange={(hideCodForHighRisk) => setRules({ hideCodForHighRisk })}
          weight="semibold"
          divided
        />
        <SwitchRow
          id="rule-partial"
          label={s.rules.partial}
          description={s.rules.partialHelp}
          checked={partial.enabled}
          onChange={(enabled) => setPartial({ enabled })}
          weight="semibold"
          divided
        />
        {partial.enabled ? (
          <>
            <NumberRow
              id="rule-partial-above"
              label={s.rules.partialAbove}
              value={partial.abovePaise / RUPEE}
              min={0}
              onChange={(rupees) => setPartial({ abovePaise: rupees * RUPEE })}
            />
            <NumberRow
              id="rule-partial-percent"
              label={s.rules.partialPercent}
              value={partial.percent}
              min={1}
              max={90}
              onChange={(percent) => setPartial({ percent })}
            />
          </>
        ) : null}
      </SettingsCard>
    </div>
  )
}
