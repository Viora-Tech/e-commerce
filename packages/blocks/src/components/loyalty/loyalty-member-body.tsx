'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { formatPaise } from '../../money'
import LoyaltyCodesList from './loyalty-codes-list'
import LoyaltyEarnList from './loyalty-earn-list'
import { dayLabel } from './loyalty-format'
import LoyaltyReferralCard from './loyalty-referral-card'
import LoyaltyRewardList from './loyalty-reward-list'
import LoyaltyTierCard from './loyalty-tier-card'
import type { LoyaltyMemberView, LoyaltyView } from './loyalty-types'

type LoyaltyMemberBodyProps = {
  view: LoyaltyView
  member: LoyaltyMemberView
  onChanged: () => void
}

/**
 * The panel for a signed-in member: the balance (and what it is worth as store credit), the
 * tier card, rewards to claim, the codes already claimed, ways to earn with click-through, and
 * the referral link with share buttons.
 */
export default function LoyaltyMemberBody({ view, member, onChanged }: LoyaltyMemberBodyProps) {
  // Render logic
  const names = view.pointsName
  return (
    <>
      <section className="flex flex-col gap-1 rounded-xl bg-(--kl-soft) p-4">
        <span className="text-[0.8125rem] font-medium text-(--kl-muted)">{copy.balance}</span>
        <span className="text-[1.75rem] font-bold leading-tight tabular-nums text-(--kl-ink)">
          {copy.points(member.points, names)}
        </span>
        {view.pointsAsStoreCredit && member.points > 0 ? (
          <span className="text-(--kl-ink)">
            {copy.worth(formatPaise(member.points * view.pointPaise))}
          </span>
        ) : null}
        {member.expiringSoon ? (
          <span className="text-[0.8125rem] font-medium text-(--kl-danger)">
            {copy.expiring(
              copy.points(member.expiringSoon.points, names),
              dayLabel(member.expiringSoon.lastDay),
            )}
          </span>
        ) : null}
        {member.pendingPoints > 0 ? (
          <span className="text-[0.8125rem] text-(--kl-muted)">
            {copy.pending(copy.points(member.pendingPoints, names))}
          </span>
        ) : null}
      </section>
      <LoyaltyTierCard tiers={view.tiers} tier={member.tier} names={names} />
      <LoyaltyRewardList
        title={copy.rewards.title}
        rewards={view.rewards}
        names={names}
        points={member.points}
        onClaimed={onChanged}
      />
      <LoyaltyCodesList codes={member.codes} />
      <LoyaltyEarnList ways={view.waysToEarn} names={names} interactive onChanged={onChanged} />
      {view.referral ? (
        <LoyaltyReferralCard referral={view.referral} names={names} storeName={view.storeName} />
      ) : null}
    </>
  )
}
