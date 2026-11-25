'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Switch } from '@commerce/ui/shadcn/switch'
import NumberField from '@/components/apps/affiliates/number-field'
import SetupCard from '@/components/apps/affiliates/setup-card'
import SectionHead from '@/components/layout/section-head'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy } from '@/hooks/use-copy'

type ProgramIncentivesProps = {
  coupon: ProgramRules['coupon']
  onChange: (coupon: ProgramRules['coupon']) => void
}

/** Program editor › Customer incentives: the affiliate's personal discount code and what buyers save. */
export default function ProgramIncentives({ coupon, onChange }: ProgramIncentivesProps) {
  // Hooks
  const { editor: copy } = useCopy(affiliatesLayoutContent)
  const { settings } = useCopy(affiliatesContent)

  // Render logic
  return (
    <section className="flex flex-col gap-4">
      <SectionHead title={copy.sections.incentives} />
      <SetupCard
        title={copy.autoDiscount}
        description={copy.autoDiscountHelp}
        active={coupon.enabled}
      >
        <SettingsRow
          label={settings.couponOn}
          description={settings.couponHelp}
          htmlFor="aff-coupon"
        >
          <Switch
            id="aff-coupon"
            checked={coupon.enabled}
            onCheckedChange={(enabled) => onChange({ ...coupon, enabled })}
          />
        </SettingsRow>
        {coupon.enabled ? (
          <NumberField
            id="aff-coupon-rate"
            label={settings.couponRate}
            value={coupon.bp}
            scale={100}
            min={1}
            max={100}
            onChange={(bp) => onChange({ ...coupon, bp: Math.min(10_000, Math.max(1, bp)) })}
          />
        ) : null}
      </SetupCard>
    </section>
  )
}
