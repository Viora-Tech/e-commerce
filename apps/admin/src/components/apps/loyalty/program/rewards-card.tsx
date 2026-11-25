'use client'

import type { RewardRow } from '@commerce/core'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { TierDraft } from '@/lib/loyalty-program'
import { routes } from '@/lib/routes'
import RewardIcon from '../reward/reward-icon'
import ListRow from './list-row'
import ListSection from './list-section'

type RewardsCardProps = {
  rewards: RewardRow[]
  tiers: TierDraft[]
}

/** Rewards to redeem: each row opens the reward's page; + Reward opens New reward. */
export default function RewardsCard({ rewards, tiers }: RewardsCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const fmt = useFormat()

  // Helpers
  const tierName = (id: string | null) => tiers.find((t) => t.id === id)?.name ?? null
  const cost = (r: RewardRow) => {
    const n = fmt.number(r.pointsCost)
    return r.type === 'custom_amount_off' ? copy.rewards.costPerStep(n) : copy.rewards.cost(n)
  }

  // Render logic
  const c = copy.rewards

  return (
    <ListSection
      title={c.heading}
      subtitle={c.help}
      action={
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={routes.apps.page('loyalty', 'rewards', 'new')} />}
        >
          <Plus />
          {c.add}
        </Button>
      }
    >
      {rewards.length === 0 ? (
        <li>
          <EmptyState variant="dashed" body={c.empty} />
        </li>
      ) : null}
      {rewards.map((r, i) => {
        const tier = tierName(r.minTierId)
        return (
          <ListRow
            key={r.id}
            raised={i === 0}
            icon={<RewardIcon type={r.type} />}
            label={r.title}
            badge={
              <>
                {tier ? (
                  <StatusChip tone="info" dot={false}>
                    {c.tierOnly(tier)}
                  </StatusChip>
                ) : null}
                {r.active ? null : (
                  <StatusChip tone="neutral" dot={false}>
                    {c.inactive}
                  </StatusChip>
                )}
              </>
            }
            value={cost(r)}
            href={routes.apps.page('loyalty', 'rewards', r.id)}
          />
        )
      })}
    </ListSection>
  )
}
