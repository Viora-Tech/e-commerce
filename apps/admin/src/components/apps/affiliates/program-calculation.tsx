'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import ProgramExcludes from '@/components/apps/affiliates/program-excludes'
import SetupCard from '@/components/apps/affiliates/setup-card'
import SectionHead from '@/components/layout/section-head'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy } from '@/hooks/use-copy'

type ProgramCalculationProps = {
  excludes: ProgramRules['excludes']
  onChange: (excludes: ProgramRules['excludes']) => void
}

/**
 * Program editor › Commission calculation: excluded products and collections, then the fees and
 * self-referrals that are always left out (GST, shipping and gift cards never earn; an
 * affiliate's own order never earns), shown as fixed rows rather than switches.
 */
export default function ProgramCalculation({ excludes, onChange }: ProgramCalculationProps) {
  // Hooks
  const { editor: copy } = useCopy(affiliatesLayoutContent)

  // Render logic
  const always = <StatusChip tone="success">{copy.always}</StatusChip>

  return (
    <section className="flex flex-col gap-4">
      <SectionHead title={copy.sections.calculation} />
      <SetupCard title={copy.excluded} description={copy.excludedHelp} active={excludes.length > 0}>
        <ProgramExcludes excludes={excludes} onChange={onChange} />
      </SetupCard>
      <SettingsCard title={copy.fees} description={copy.feesHelp}>
        <SettingsRow label={copy.excludeTax}>{always}</SettingsRow>
        <SettingsRow label={copy.excludeShipping}>{always}</SettingsRow>
        <SettingsRow label={copy.excludeGiftCards}>{always}</SettingsRow>
      </SettingsCard>
      <SettingsCard title={copy.selfReferrals}>
        <SettingsRow label={copy.excludeSelf} description={copy.excludeSelfHelp}>
          {always}
        </SettingsRow>
      </SettingsCard>
    </section>
  )
}
