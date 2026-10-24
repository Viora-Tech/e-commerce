'use client'

import type { CommissionRule } from '@commerce/plugin-affiliates/settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import { ruleLabel } from '@/components/apps/affiliates/rule-label'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type AffiliateProgramCardProps = {
  affiliateId: string
  programId: string | null
  programs: { id: string; name: string; isDefault: boolean }[]
  programRule: CommissionRule | null
  rateOverride: CommissionRule | null
  onChanged: () => void
}

/** Which program an affiliate is in, and their own default rate above it. */
export default function AffiliateProgramCard({
  affiliateId,
  programId,
  programs,
  programRule,
  rateOverride,
  onChanged,
}: AffiliateProgramCardProps) {
  // Hooks
  const copy = useCopy(affiliatesContent)
  const f = useFormat()
  const [own, setOwn] = useState(rateOverride !== null)
  const [percent, setPercent] = useState(
    rateOverride?.type === 'percent' ? rateOverride.bp / 100 : 15,
  )
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleProgram = async (next: string) => {
    try {
      await api.affiliates.setProgram({ id: affiliateId, programId: next })
      toast.success(copy.detail.moved)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    }
  }
  const handleSaveRate = async () => {
    setBusy(true)
    try {
      const rule: CommissionRule | null = own
        ? { type: 'percent', bp: Math.min(10_000, Math.round(percent * 100)) }
        : null
      await api.affiliates.setRate({ id: affiliateId, rule })
      toast.success(copy.detail.rateSaved)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const d = copy.detail
  const current = programId ?? programs.find((p) => p.isDefault)?.id ?? ''

  return (
    <SettingsCard
      title={d.programCard}
      description={
        programRule ? d.programRate(ruleLabel(programRule, copy.programs, f.money)) : undefined
      }
      footer={
        <Button variant="outline" onClick={handleSaveRate} disabled={busy}>
          {d.saveRate}
        </Button>
      }
    >
      <SettingsRow label={d.programLabel} htmlFor="aff-program">
        <NativeSelect
          id="aff-program"
          value={current}
          onChange={(e) => handleProgram(e.target.value)}
        >
          {programs.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </SettingsRow>
      <SettingsRow label={d.ownRateOn} description={d.ownRateHelp} htmlFor="aff-own-rate">
        <Switch id="aff-own-rate" checked={own} onCheckedChange={setOwn} />
      </SettingsRow>
      {own ? (
        <SettingsRow label={d.ownRatePercent} htmlFor="aff-own-percent">
          <Input
            id="aff-own-percent"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.01}
            className="max-w-40"
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value) || 0)}
          />
        </SettingsRow>
      ) : null}
    </SettingsCard>
  )
}
