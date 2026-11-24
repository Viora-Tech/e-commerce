'use client'

import type { ReferralReward } from '@commerce/core/loyalty'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'

type ReferralRewardFieldsProps = {
  id: string
  label: string
  reward: ReferralReward
  onChange: (reward: ReferralReward) => void
}

const KINDS = ['points', 'percent', 'fixed'] as const

/** The field's number: points and percent as they are, a fixed amount in whole rupees. */
const shown = (r: ReferralReward) => (r.kind === 'fixed' ? Math.round(r.value / 100) : r.value)

/** One side's referral reward: points, a percent off or an amount off, and how much. */
export default function ReferralRewardFields({
  id,
  label,
  reward,
  onChange,
}: ReferralRewardFieldsProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)

  // Event handlers
  const handleKind = (kind: ReferralReward['kind']) =>
    onChange({ kind, value: kind === 'percent' ? 10 : kind === 'fixed' ? 10_000 : 100 })

  const handleValue = (raw: string) => {
    const n = Math.max(1, Math.round(Number(raw) || 1))
    const value =
      reward.kind === 'fixed' ? n * 100 : reward.kind === 'percent' ? Math.min(90, n) : n
    onChange({ ...reward, value })
  }

  // Render logic
  const c = copy.referrals

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-body font-medium text-ink-strong">{label}</legend>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-kind`}>{c.kind}</FieldLabel>
          <NativeSelect
            id={`${id}-kind`}
            value={reward.kind}
            onChange={(e) => handleKind(e.target.value as ReferralReward['kind'])}
          >
            {KINDS.map((k) => (
              <NativeSelectOption key={k} value={k}>
                {c.kinds[k]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-value`}>{c.value[reward.kind]}</FieldLabel>
          <Input
            id={`${id}-value`}
            size="lg"
            type="number"
            inputMode="numeric"
            min={1}
            max={reward.kind === 'percent' ? 90 : undefined}
            className="w-40"
            value={shown(reward)}
            onChange={(e) => handleValue(e.target.value)}
          />
          {reward.kind === 'percent' ? <FieldDescription>{c.percentHelp}</FieldDescription> : null}
        </Field>
      </div>
    </fieldset>
  )
}
