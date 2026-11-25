'use client'

import type { RewardRow, TierRow } from '@commerce/core'
import { ChevronRight } from '@commerce/ui/icons'
import DataCard from '@/components/layout/data-card'
import { loyaltyRewardContent } from '@/data/loyalty-reward'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { amountText, fillTitle, givesCode, type RewardForm } from '@/lib/loyalty-reward-form'
import RewardIcon from './reward-icon'

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

/**
 * The right column: the reward as shoppers see it in the loyalty panel, then a Summary of the
 * reward in a few plain lines, both updating as the form changes.
 */
export default function RewardSummary({ form, reward, tiers }: RewardSummaryProps) {
  // Hooks
  const copy = useCopy(loyaltyRewardContent)
  const fmt = useFormat()

  // Render logic
  const s = copy.summaryLines
  const amount = amountText(form, fmt.money)
  const title = fillTitle(form.title, amount) || copy.newTitle
  const tier = tiers.find((t) => t.id === form.minTierId)
  const lo = whole(form.minPoints)
  const hi = whole(form.maxPoints)
  const minOrder = Number(form.minOrder)
  const limit = whole(form.usageLimit)
  const days = whole(form.codeDays)
  const points = copy.points(form.pointsCost)
  const lines = [
    form.type === 'custom_amount_off' ? s.costsStep(points, amount) : s.what(title, points),
    s.applies[form.type],
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
  ].filter((l): l is string => Boolean(l))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-caption font-medium text-muted-foreground">{copy.preview}</span>
        <div className="rounded-lg bg-muted p-5">
          <div className="flex items-center gap-3 rounded-lg border border-line bg-card p-4 shadow-xs">
            <RewardIcon type={form.type} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-medium text-ink-strong">{title}</span>
              <span className="text-caption text-muted-foreground">
                {form.type === 'custom_amount_off'
                  ? copy.redeemStep(points)
                  : copy.redeemFor(points)}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </div>
      </div>
      <DataCard title={copy.summary}>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </DataCard>
    </div>
  )
}
