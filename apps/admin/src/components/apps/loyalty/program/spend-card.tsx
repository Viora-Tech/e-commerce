'use client'

import type { LoyaltySettings } from '@commerce/core/loyalty'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import NumberRow from '@/components/apps/cod-rto/number-row'
import SwitchRow from '@/components/fields/switch-row'
import TagInput from '@/components/fields/tag-input'
import SettingsCard from '@/components/settings/settings-card'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import type { SpendDraft } from '@/lib/loyalty-program'

type SpendCardProps = {
  spend: SpendDraft
  settings: LoyaltySettings
  onSpend: (patch: Partial<SpendDraft>) => void
  onSettings: (patch: Partial<LoyaltySettings>) => void
}

/** Points per spend: the base rate (the order spend rule), products that earn nothing, shipping and taxes. */
export default function SpendCard({ spend, settings, onSpend, onSettings }: SpendCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)

  // Render logic
  const c = copy.spend

  return (
    <SettingsCard title={c.heading} description={c.help}>
      <SwitchRow
        label={c.enabled}
        checked={spend.enabled}
        onChange={(enabled) => onSpend({ enabled })}
      />
      <NumberRow
        id="loyalty-spend-rate"
        label={c.rate}
        description={c.rateHelp}
        value={spend.points}
        min={0}
        max={100}
        onChange={(points) => onSpend({ points })}
      />
      <Field>
        <FieldLabel htmlFor="loyalty-spend-exclude">{c.excludeTags}</FieldLabel>
        <TagInput
          id="loyalty-spend-exclude"
          tags={spend.excludeProductTags}
          suggestions={[]}
          placeholder={c.tagPlaceholder}
          onChange={(excludeProductTags) => onSpend({ excludeProductTags })}
        />
        <FieldDescription>{c.excludeTagsHelp}</FieldDescription>
      </Field>
      <SwitchRow
        label={c.shipping}
        description={c.shippingHelp}
        checked={settings.includeShipping}
        onChange={(includeShipping) => onSettings({ includeShipping })}
      />
      <SwitchRow
        label={c.taxes}
        description={c.taxesHelp}
        checked={settings.includeTaxes}
        onChange={(includeTaxes) => onSettings({ includeTaxes })}
      />
    </SettingsCard>
  )
}
