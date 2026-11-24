'use client'

import { useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { formatPaise } from '../../money'
import LoyaltyClaimedCode from './loyalty-claimed-code'
import { redeemReward } from './loyalty-client'
import { rewardValueLabel } from './loyalty-format'
import { rewardCost } from './loyalty-math'
import type { LoyaltyPointsName, LoyaltyRedeemed, LoyaltyRewardView } from './loyalty-types'

type LoyaltyRewardListProps = {
  title: string
  rewards: LoyaltyRewardView[]
  names: LoyaltyPointsName
  /** The member's points; null for a guest (no Claim buttons). */
  points: number | null
  /** Called after a claim, so the balance and codes refresh; null for a guest. */
  onClaimed: (() => void) | null
}

/** The line under a reward: its cost, or why it cannot be taken yet. */
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
 * The rewards catalog. A guest sees what each costs ("Ways to redeem"); a member gets a Claim
 * button on each reward they can take now, and the code (Copy, Apply at checkout) once claimed.
 * A custom amount reward is claimed at its smallest step.
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
    <section className="flex flex-col gap-2 rounded-xl border border-(--kl-line) p-4">
      <h3 className="m-0 text-[1rem] font-bold text-(--kl-ink)">{title}</h3>
      {claimed ? <LoyaltyClaimedCode redeemed={claimed} /> : null}
      <ul className="m-0 flex list-none flex-col p-0">
        {rewards.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-1 border-t border-(--kl-line) py-2.5 first:border-t-0"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-(--kl-ink)">{r.title}</span>
                <span className="text-[0.8125rem] text-(--kl-muted)">
                  {rewardValueLabel(r)} · {costLine(r, names, points)}
                </span>
                {r.minOrderPaise ? (
                  <span className="text-[0.8125rem] text-(--kl-muted)">
                    {copy.rewards.minOrder(formatPaise(r.minOrderPaise))}
                  </span>
                ) : null}
              </span>
              {points !== null && onClaimed && !r.block ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => handleClaim(r)}
                  className="shrink-0 rounded-full border-0 bg-(image:--kl-head) bg-(--kl-head-solid) px-4 py-1.5 text-[0.8125rem] font-semibold text-(--kl-head-text) disabled:opacity-60"
                >
                  {busy === r.id ? copy.rewards.claiming : copy.rewards.claim}
                </button>
              ) : null}
            </span>
            {failed === r.id ? (
              <span role="alert" className="text-[0.8125rem] text-(--kl-danger)">
                {copy.rewards.failed}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
