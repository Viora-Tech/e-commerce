'use client'

import type { RewardRow } from '@commerce/core'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { loyaltyRewardContent } from '@/data/loyalty-reward'
import { useCopy } from '@/hooks/use-copy'
import type { TierDraft } from '@/lib/loyalty-program'
import { routes } from '@/lib/routes'

type RewardsCardProps = {
  rewards: RewardRow[]
  tiers: TierDraft[]
}

/** The rewards catalog: each row opens the reward's page; + Reward opens New reward. */
export default function RewardsCard({ rewards, tiers }: RewardsCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const rewardCopy = useCopy(loyaltyRewardContent)

  // Helpers
  const tierName = (id: string | null) => tiers.find((t) => t.id === id)?.name ?? null

  // Render logic
  const c = copy.rewards

  return (
    <DataCard
      title={c.heading}
      subtitle={c.help}
      count={rewards.length}
      flush={rewards.length > 0}
      action={
        <Button
          size="sm"
          variant="outline"
          render={<Link href={routes.apps.page('loyalty', 'rewards', 'new')} />}
        >
          <Plus />
          {c.add}
        </Button>
      }
    >
      {rewards.length === 0 ? (
        <EmptyState variant="dashed" body={c.empty} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rewards.map((r) => {
            const tier = tierName(r.minTierId)
            return (
              <li key={r.id}>
                <Link
                  href={routes.apps.page('loyalty', 'rewards', r.id)}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-medium text-ink-strong">
                      {r.title}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {rewardCopy.types[r.type]}
                      {tier ? ` · ${c.tierOnly(tier)}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-body tabular-nums text-foreground">
                    {r.type === 'custom_amount_off'
                      ? c.costPerStep(r.pointsCost)
                      : c.cost(r.pointsCost)}
                  </span>
                  <StatusChip tone={r.active ? 'success' : 'neutral'}>
                    {r.active ? c.active : c.inactive}
                  </StatusChip>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </DataCard>
  )
}
