'use client'

import { FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import SettingsRow from '@/components/settings/settings-row'
import { profitCostsContent } from '@/data/profit-costs'
import { useCopy } from '@/hooks/use-copy'

/** A rate as typed: percent and rupees, kept as text until saved. */
export type FeeRateText = { percent: string; fixed: string }

type FeeRateRowProps = {
  id: string
  label: string
  value: FeeRateText
  onChange: (value: FeeRateText) => void
  disabled: boolean
}

/** One method's fee: a percent and a fixed rupee amount side by side. */
export default function FeeRateRow({ id, label, value, onChange, disabled }: FeeRateRowProps) {
  // Hooks
  const copy = useCopy(profitCostsContent)

  return (
    <SettingsRow label={label} htmlFor={`${id}-percent`}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={`${id}-percent`}>{copy.percent}</FieldLabel>
          <Input
            size="lg"
            id={`${id}-percent`}
            inputMode="decimal"
            className="w-28"
            value={value.percent}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, percent: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={`${id}-fixed`}>{copy.fixed}</FieldLabel>
          <Input
            size="lg"
            id={`${id}-fixed`}
            inputMode="decimal"
            className="w-28"
            value={value.fixed}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, fixed: e.target.value })}
          />
        </div>
      </div>
    </SettingsRow>
  )
}
