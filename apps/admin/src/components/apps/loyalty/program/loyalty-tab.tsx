'use client'

import type { EarnRuleRow, RewardRow } from '@commerce/core'
import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import { newTierDraft, type ProgramDraft, type TierDraft } from '@/lib/loyalty-program'
import EarnRulesCard from './earn-rules-card'
import PerksCard from './perks-card'
import ProgramSettingsCard from './program-settings-card'
import RewardsCard from './rewards-card'
import SpendCard from './spend-card'
import TiersCard from './tiers-card'

type LoyaltyTabProps = {
  draft: ProgramDraft
  rules: EarnRuleRow[]
  rewards: RewardRow[]
  onDraft: Dispatch<SetStateAction<ProgramDraft | null>>
  onRules: (rules: EarnRuleRow[]) => void
  /** A saved tier was removed on the server. */
  onTierRemoved: (key: string) => void
}

let newKeys = 0

/** The Loyalty part of the Program page: tiers, points per spend, ways to earn, rewards, perks, settings. */
export default function LoyaltyTab({
  draft,
  rules,
  rewards,
  onDraft,
  onRules,
  onTierRemoved,
}: LoyaltyTabProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const [selectedKey, setSelectedKey] = useState<string | null>(draft.tiers[0]?.key ?? null)

  // Helpers
  const patchTier = (key: string, patch: Partial<TierDraft>) =>
    onDraft((d) =>
      d ? { ...d, tiers: d.tiers.map((t) => (t.key === key ? { ...t, ...patch } : t)) } : d,
    )

  // Event handlers
  const handleAddTier = () => {
    newKeys += 1
    const key = `new-${newKeys}`
    const tier = newTierDraft(
      draft.tiers,
      draft.settings.tierBasis,
      copy.tiers.newName(draft.tiers.length + 1),
      key,
    )
    onDraft((d) => (d ? { ...d, tiers: [...d.tiers, tier] } : d))
    setSelectedKey(key)
  }

  const handleRemoveTier = (key: string, wasSaved: boolean) => {
    if (wasSaved) onTierRemoved(key)
    else onDraft((d) => (d ? { ...d, tiers: d.tiers.filter((t) => t.key !== key) } : d))
    setSelectedKey(null)
  }

  // Render logic
  const selected = draft.tiers.find((t) => t.key === selectedKey) ?? draft.tiers[0] ?? null

  return (
    <div className="flex flex-col gap-5">
      <TiersCard
        tiers={draft.tiers}
        selected={selected}
        settings={draft.settings}
        rewards={rewards}
        onSelect={setSelectedKey}
        onAdd={handleAddTier}
        onChange={patchTier}
        onRemove={handleRemoveTier}
      />
      <SpendCard
        spend={draft.spend}
        settings={draft.settings}
        onSpend={(patch) => onDraft((d) => (d ? { ...d, spend: { ...d.spend, ...patch } } : d))}
        onSettings={(patch) =>
          onDraft((d) => (d ? { ...d, settings: { ...d.settings, ...patch } } : d))
        }
      />
      <EarnRulesCard rules={rules} onRules={onRules} />
      <RewardsCard rewards={rewards} tiers={draft.tiers} />
      <PerksCard
        tier={selected}
        onChange={(perks) => selected && patchTier(selected.key, { perks })}
      />
      <ProgramSettingsCard
        settings={draft.settings}
        onChange={(patch) =>
          onDraft((d) => (d ? { ...d, settings: { ...d.settings, ...patch } } : d))
        }
      />
    </div>
  )
}
