'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import NumberField from '@/components/apps/affiliates/number-field'
import ProgramLevels from '@/components/apps/affiliates/program-levels'
import ProgramOverrides from '@/components/apps/affiliates/program-overrides'
import ProgramTiers from '@/components/apps/affiliates/program-tiers'
import SetupCard from '@/components/apps/affiliates/setup-card'
import MoneyInput from '@/components/fields/money-input'
import SectionHead from '@/components/layout/section-head'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy } from '@/hooks/use-copy'

type ProgramCommissionRulesProps = {
  rules: ProgramRules
  onChange: (patch: Partial<ProgramRules>) => void
}

/** Typed rupees or percent (2 places) to stored paise or basis points. */
const toHundredths = (typed: string) => Math.max(0, Math.round((Number(typed) || 0) * 100))

/**
 * Program editor › Commission rules (UpPromote's order): Default commission with Rule, Type and
 * Amount; Special product commission; Advanced commission (lifetime); Affiliate tiers.
 */
export default function ProgramCommissionRules({ rules, onChange }: ProgramCommissionRulesProps) {
  // Hooks
  const { editor: copy } = useCopy(affiliatesLayoutContent)
  const { settings } = useCopy(affiliatesContent)
  const [tiered, setTiered] = useState(rules.levels.length > 0)

  // Event handlers
  const handleRule = (next: string) => {
    setTiered(next === 'tiered')
    if (next === 'simple') onChange({ levels: [] })
  }
  const handleType = (type: string) =>
    onChange({
      commission: type === 'flat' ? { type: 'flat', paise: 100_00 } : { type: 'percent', bp: 1000 },
    })
  const handleAmount = (typed: string) =>
    onChange({
      commission:
        rules.commission.type === 'percent'
          ? { type: 'percent', bp: Math.min(10_000, toHundredths(typed)) }
          : { type: 'flat', paise: toHundredths(typed) },
    })

  // Render logic
  const c = rules.commission
  const amount = (c.type === 'percent' ? c.bp : c.paise) / 100

  return (
    <section className="flex flex-col gap-4">
      <SectionHead title={copy.sections.rules} />
      <SettingsCard title={copy.defaultCommission} description={copy.defaultHelp}>
        <SettingsRow label={copy.rule} htmlFor="aff-rule">
          <NativeSelect
            id="aff-rule"
            value={tiered ? 'tiered' : 'simple'}
            onChange={(e) => handleRule(e.target.value)}
          >
            <NativeSelectOption value="simple">{copy.rules.simple}</NativeSelectOption>
            <NativeSelectOption value="tiered">{copy.rules.tiered}</NativeSelectOption>
          </NativeSelect>
        </SettingsRow>
        <SettingsRow label={copy.type} htmlFor="aff-type">
          <div className="grid gap-2 sm:grid-cols-2">
            <NativeSelect id="aff-type" value={c.type} onChange={(e) => handleType(e.target.value)}>
              <NativeSelectOption value="percent">{copy.types.percent}</NativeSelectOption>
              <NativeSelectOption value="flat">{copy.types.flat}</NativeSelectOption>
            </NativeSelect>
            <MoneyInput
              aria-label={copy.amount}
              value={String(amount)}
              onChange={handleAmount}
              currency={c.type === 'flat'}
              suffix={c.type === 'percent' ? '%' : undefined}
            />
          </div>
        </SettingsRow>
        {tiered ? (
          <ProgramLevels levels={rules.levels} onChange={(levels) => onChange({ levels })} />
        ) : null}
      </SettingsCard>
      <SetupCard
        title={copy.special}
        description={copy.specialHelp}
        active={rules.overrides.length > 0}
      >
        <ProgramOverrides
          overrides={rules.overrides}
          onChange={(overrides) => onChange({ overrides })}
        />
      </SetupCard>
      <SettingsCard title={copy.advanced}>
        <SettingsRow label={copy.lifetime} description={copy.lifetimeHelp} htmlFor="aff-lifetime">
          <Switch
            id="aff-lifetime"
            checked={rules.scope === 'lifetime'}
            onCheckedChange={(on) => onChange({ scope: on ? 'lifetime' : 'first_order' })}
          />
        </SettingsRow>
        {rules.scope === 'lifetime' ? (
          <NumberField
            id="aff-lifetime-days"
            label={settings.lifetimeDays}
            value={rules.lifetimeDays}
            min={1}
            max={3650}
            onChange={(lifetimeDays) => onChange({ lifetimeDays: Math.max(1, lifetimeDays) })}
          />
        ) : null}
      </SettingsCard>
      <SetupCard title={copy.tiers} description={copy.tiersHelp} active={rules.tiers.length > 0}>
        <ProgramTiers tiers={rules.tiers} onChange={(tiers) => onChange({ tiers })} />
      </SetupCard>
    </section>
  )
}
