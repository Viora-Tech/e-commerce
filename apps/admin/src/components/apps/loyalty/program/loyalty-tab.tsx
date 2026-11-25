'use client'

import type { EarnRuleRow, RewardRow } from '@commerce/core'
import type { LoyaltySettings } from '@commerce/core/loyalty'
import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { newTierDraft, type ProgramDraft, type TierDraft } from '@/lib/loyalty-program'
import EarnRulesCard from './earn-rules-card'
import PerksCard from './perks-card'
import ProgramSettingsCard from './program-settings-card'
import RewardsCard from './rewards-card'
import SpendCard from './spend-card'
import TierPanel from './tier-panel'
import TierStrip from './tier-strip'

type LoyaltyTabProps = {
  draft: ProgramDraft
  rules: EarnRuleRow[]
  rewards: RewardRow[]
  /** For the tier card preview. */
  storeName: string
  onDraft: Dispatch<SetStateAction<ProgramDraft | null>>
  onRules: (rules: EarnRuleRow[]) => void
  /** A saved tier was removed on the server. */
  onTierRemoved: (key: string) => void
}

let newKeys = 0

/**
 * The Loyalty part of the Program page: the tier strip, then points per spend, earning rules,
 * rewards, perks and settings on the left, the picked tier's card and fields on the right.
 */
export default function LoyaltyTab({
  draft,
  rules,
  rewards,
  storeName,
  onDraft,
  onRules,
  onTierRemoved,
}: LoyaltyTabProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const [selectedKey, setSelectedKey] = useState<string | null>(draft.tiers[0]?.key ?? null)
  const [removing, setRemoving] = useState<TierDraft | null>(null)

  // Helpers
  const patchTier = (key: string, patch: Partial<TierDraft>) =>
    onDraft((d) =>
      d ? { ...d, tiers: d.tiers.map((t) => (t.key === key ? { ...t, ...patch } : t)) } : d,
    )
  const patchSettings = (patch: Partial<LoyaltySettings>) =>
    onDraft((d) => (d ? { ...d, settings: { ...d.settings, ...patch } } : d))

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

  const handleRemoveTier = async () => {
    if (!removing) return
    if (removing.id) {
      try {
        await api.loyalty.tiers.remove({ id: removing.id })
        toast.success(copy.tiers.removed)
        onTierRemoved(removing.key)
      } catch (err) {
        toast.error(errorText(err, copy.failed))
        throw err
      }
    } else {
      onDraft((d) => (d ? { ...d, tiers: d.tiers.filter((t) => t.key !== removing.key) } : d))
    }
    setRemoving(null)
    setSelectedKey(null)
  }

  // Render logic
  const selected = draft.tiers.find((t) => t.key === selectedKey) ?? draft.tiers[0] ?? null
  const index = selected ? draft.tiers.findIndex((t) => t.key === selected.key) : -1
  const next = index >= 0 ? (draft.tiers[index + 1] ?? null) : null

  return (
    <div className="flex flex-col gap-5">
      <TierStrip
        tiers={draft.tiers}
        selected={selected}
        settings={draft.settings}
        onSelect={setSelectedKey}
        onAdd={handleAddTier}
      />
      <div
        className={
          selected
            ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]'
            : 'grid items-start gap-6'
        }
      >
        <div className="flex min-w-0 flex-col gap-6">
          <SpendCard
            spend={draft.spend}
            settings={draft.settings}
            tier={selected}
            onSpend={(patch) => onDraft((d) => (d ? { ...d, spend: { ...d.spend, ...patch } } : d))}
            onSettings={patchSettings}
            onTier={(patch) => selected && patchTier(selected.key, patch)}
          />
          <EarnRulesCard rules={rules} onRules={onRules} />
          <RewardsCard rewards={rewards} tiers={draft.tiers} />
          <PerksCard
            tier={selected}
            onChange={(perks) => selected && patchTier(selected.key, { perks })}
          />
          <ProgramSettingsCard settings={draft.settings} onChange={patchSettings} />
        </div>
        <div className="min-w-0 lg:sticky lg:top-4">
          {selected ? (
            <TierPanel
              key={selected.key}
              tier={selected}
              next={next}
              first={index === 0}
              settings={draft.settings}
              rewards={rewards}
              storeName={storeName}
              onChange={(patch) => patchTier(selected.key, patch)}
              onRemove={() => setRemoving(selected)}
            />
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (!open ? setRemoving(null) : undefined)}
        title={copy.tiers.removeTitle(removing?.name ?? '')}
        body={copy.tiers.removeBody}
        confirmLabel={copy.tiers.remove}
        tone="destructive"
        onConfirm={handleRemoveTier}
      />
    </div>
  )
}
