'use client'

import { useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { formatPaise } from '../../money'
import LoyaltyCard from './loyalty-card'
import LoyaltyClaimedCode from './loyalty-claimed-code'
import { redeemReward } from './loyalty-client'
import { rewardCost, rewardProgress } from './loyalty-math'
import { DARK_BUTTON, PROGRESS_FILL, PROGRESS_TRACK } from './loyalty-styles'
import type { LoyaltyPointsName, LoyaltyRedeemed, LoyaltyRewardView } from './loyalty-types'

type LoyaltyRewardListProps = {
  /** The card's heading; '' inside the panel's "Ways to redeem" screen, whose header names it. */
  title: string
  rewards: LoyaltyRewardView[]
  names: LoyaltyPointsName
  /** The member's points; null for a guest (no Claim buttons). */
  points: number | null
  /** Called after a claim, so the balance and codes refresh; null for a guest. */
  onClaimed: (() => void) | null
}

/** The line under a reward: its cost ("for 1,000 points"), or why it cannot be taken yet. */
function costLine(r: LoyaltyRewardView, names: LoyaltyPointsName, points: number | null) {
  const cost = rewardCost(r)
  const base =
    r.type === 'custom_amount_off'
      ? copy.rewards.customCost(copy.points(r.pointsCost, names), formatPaise(r.value))
      : copy.rewards.cost(copy.points(cost, names))
  if (points === null || !r.block) return base
  if (r.block === 'points') return copy.rewards.needMore(copy.points(cost - points, names))
  return copy.rewards.blocked[r.block] ?? base
}

/**
 * The rewards catalog, Essential Loyalty's way: each reward's title, its cost ("for 1,000
 * points") and a thin bar of the shopper's points toward it (empty for a visitor). A member gets
 * Claim on each reward they can take now, and the code (Copy, Apply at checkout) once claimed. A
 * custom amount reward is claimed at its smallest step.
 */
export default function LoyaltyRewardList({
  title,
  rewards,
  names,
  points,
  onClaimed,
}: LoyaltyRewardListProps) {
  // Hooks
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [claimed, setClaimed] = useState<LoyaltyRedeemed | null>(null)

  // Event handlers
  const handleClaim = async (r: LoyaltyRewardView) => {
    setBusy(r.id)
    setFailed(null)
    const done = await redeemReward(
      r.id,
      r.type === 'custom_amount_off' ? rewardCost(r) : undefined,
    )
    setBusy(null)
    if (!done) {
      setFailed(r.id)
      return
    }
    setClaimed(done)
    onClaimed?.()
  }

  // Early returns
  if (rewards.length === 0) return null

  // Render logic
  return (
    <LoyaltyCard title={title || undefined}>
      {claimed ? <LoyaltyClaimedCode redeemed={claimed} /> : null}
      <ul className="m-0 -my-2 flex list-none flex-col p-0">
        {rewards.map((r) => {
          const pct = rewardProgress(points, rewardCost(r))
          const canClaim = points !== null && onClaimed !== null && !r.block
          return (
            <li
              key={r.id}
              className="flex flex-col gap-2 border-t border-(--kl-line) py-3 first:border-t-0"
            >
              <span className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[0.875rem] font-semibold text-(--kl-ink)">{r.title}</span>
                  <span className="text-[0.8125rem] text-(--kl-muted)">
                    {costLine(r, names, points)}
                  </span>
                  {r.minOrderPaise ? (
                    <span className="text-[0.8125rem] text-(--kl-muted)">
                      {copy.rewards.minOrder(formatPaise(r.minOrderPaise))}
                    </span>
                  ) : null}
                </span>
                {canClaim ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => handleClaim(r)}
                    className={`${DARK_BUTTON} h-8! px-4!`}
                  >
                    {busy === r.id ? copy.rewards.claiming : copy.rewards.claim}
                  </button>
                ) : null}
              </span>
              <span
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={r.title}
                className={PROGRESS_TRACK}
              >
                <span className={PROGRESS_FILL} style={{ width: `${pct}%` }} />
              </span>
              {failed === r.id ? (
                <span role="alert" className="text-[0.8125rem] text-(--kl-danger)">
                  {copy.rewards.failed}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </LoyaltyCard>
  )
}
