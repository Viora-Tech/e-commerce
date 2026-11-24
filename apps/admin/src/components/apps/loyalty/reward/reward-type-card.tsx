'use client'

import { LOYALTY_REWARD_TYPES, type LoyaltyRewardType } from '@commerce/core/loyalty'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import type { Dispatch, SetStateAction } from 'react'
import ChoiceTile from '@/components/fields/choice-tile'
import DataCard from '@/components/layout/data-card'
import { loyaltyRewardContent } from '@/data/loyalty-reward'
import { useCopy } from '@/hooks/use-copy'
import { type RewardForm, switchType } from '@/lib/loyalty-reward-form'

type RewardTypeCardProps = {
  form: RewardForm
  onChange: Dispatch<SetStateAction<RewardForm | null>>
}

/** The reward type as tiles: amount off, member-picked amount, percent, free product, free shipping, store credit. */
export default function RewardTypeCard({ form, onChange }: RewardTypeCardProps) {
  // Hooks
  const copy = useCopy(loyaltyRewardContent)

  // Event handlers
  const handleType = (type: LoyaltyRewardType) =>
    onChange((f) => (f ? switchType(f, type, copy.defaultTitles) : f))

  // Render logic
  return (
    <DataCard title={copy.typeHeading}>
      <RadioGroup
        value={form.type}
        onValueChange={(v) => handleType(v as LoyaltyRewardType)}
        className="grid gap-3 md:grid-cols-2"
      >
        {LOYALTY_REWARD_TYPES.map((t) => (
          <ChoiceTile
            key={t}
            name="reward-type"
            value={t}
            checked={form.type === t}
            label={copy.types[t]}
            help={copy.typeHelp[t]}
          />
        ))}
      </RadioGroup>
    </DataCard>
  )
}
