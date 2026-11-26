'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import LoyaltyIcon from './loyalty-icon'
import { nextRewardOf } from './loyalty-math'
import { DARK_BUTTON, PROGRESS_FILL, PROGRESS_TRACK } from './loyalty-styles'
import type { LoyaltyPointsName, LoyaltyRewardView } from './loyalty-types'

type LoyaltyNextRewardCardProps = {
  rewards: LoyaltyRewardView[]
  points: number
  names: LoyaltyPointsName
  /** Opens Ways to redeem, where each reward has its own Claim. */
  onClaim: () => void
}

/**
 * A member's first card, Essential Loyalty's "Next reward": an award ribbon in the brand colour,
 * then either how many rewards are ready with a Claim button (opens Ways to redeem), or the
 * cheapest reward still out of reach with a bar and the points to go. Nothing when the store
 * offers no reward the member could reach.
 */
export default function LoyaltyNextRewardCard({
  rewards,
  points,
  names,
  onClaim,
}: LoyaltyNextRewardCardProps) {
  // Render logic
  const next = nextRewardOf(rewards, points)
  if (next.kind === 'none') return null
  return (
    <LoyaltyCard title={copy.nextReward.title}>
      <div className="flex flex-col items-center gap-3 text-center">
        <LoyaltyIcon name="award" className="size-12 text-(--kl-accent)" />
        {next.kind === 'available' ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[0.9375rem] font-semibold text-(--kl-ink)">
                {copy.nextReward.available(next.count)}
              </span>
              <span className="text-[0.875rem] text-(--kl-muted)">
                {copy.nextReward.availableSub}
              </span>
            </div>
            <button type="button" onClick={onClaim} className={DARK_BUTTON}>
              {copy.nextReward.claim}
            </button>
          </>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <span className="text-[0.9375rem] font-semibold text-(--kl-ink)">
              {next.reward.title}
            </span>
            <span
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={next.percent}
              aria-label={next.reward.title}
              className={PROGRESS_TRACK}
            >
              <span className={PROGRESS_FILL} style={{ width: `${next.percent}%` }} />
            </span>
            <span className="text-[0.875rem] text-(--kl-muted)">
              {copy.nextReward.needed(copy.points(next.needed, names))}
            </span>
          </div>
        )}
      </div>
    </LoyaltyCard>
  )
}
