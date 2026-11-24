'use client'

import type { RewardRow, TierRow } from '@commerce/core'
import DataCard from '@/components/layout/data-card'
import { loyaltyRewardContent } from '@/data/loyalty-reward'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { amountText, fillTitle, givesCode, type RewardForm } from '@/lib/loyalty-reward-form'

type RewardSummaryProps = {
  form: RewardForm
  /** The saved reward (its redeem count); null for a new one. */
  reward: RewardRow | null
  tiers: TierRow[]
}

const whole = (raw: string) => {
  const n = Math.round(Number(raw))
  return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
}

/** The side panel: the reward in a few plain lines, updating as the form changes. */
export default function RewardSummary({ form, reward, tiers }: RewardSummaryProps) {
  // Hooks
  const copy = useCopy(loyaltyRewardContent)
  const fmt = useFormat()

  // Render logic
  const s = copy.summaryLines
  const amount = amountText(form, fmt.money)
  const tier = tiers.find((t) => t.id === form.minTierId)
  const lo = whole(form.minPoints)
  const hi = whole(form.maxPoints)
  const minOrder = Number(form.minOrder)
  const limit = whole(form.usageLimit)
  const days = whole(form.codeDays)
  const lines = [
    form.type === 'custom_amount_off'
      ? s.costsStep(copy.points(form.pointsCost), amount)
      : s.costs(copy.points(form.pointsCost)),
    form.type === 'custom_amount_off' && lo && hi
      ? s.range(copy.points(lo), copy.points(hi))
      : null,
    s.who(tier ? copy.minTier(tier.name) : copy.everyoneLower),
    givesCode(form.type) && minOrder > 0 ? s.minOrder(fmt.money(Math.round(minOrder * 100))) : null,
    limit ? s.limit(limit) : null,
    form.oncePerCustomer ? s.once : null,
    givesCode(form.type) ? (days ? s.code(days) : s.codeForever) : s.noCode,
    form.active ? null : s.off,
    reward ? s.redeemed(reward.usedCount) : null,
  ].filter((l): l is string => l !== null)

  return (
    <DataCard title={copy.summary}>
      <div className="flex flex-col gap-3">
        <span className="text-card-title text-ink-strong">
          {fillTitle(form.title, amount) || copy.newTitle}
        </span>
        <span className="text-caption text-muted-foreground">{copy.types[form.type]}</span>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </DataCard>
  )
}
