'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { dayLabel } from './loyalty-format'
import LoyaltyNextRewardCard from './loyalty-next-reward-card'
import LoyaltyPointsCard, { type LoyaltyScreen } from './loyalty-points-card'
import LoyaltyReferralCard from './loyalty-referral-card'
import LoyaltyTierCard from './loyalty-tier-card'
import type { LoyaltyMemberView, LoyaltyView } from './loyalty-types'

type LoyaltyMemberBodyProps = {
  view: LoyaltyView
  member: LoyaltyMemberView
  onOpen: (screen: LoyaltyScreen) => void
}

/**
 * The panel for a signed-in member (the balance sits in the header's pill), Essential Loyalty's
 * order: Next reward (ready to claim, or the bar to the next one), the Points card (Ways to earn,
 * Ways to redeem, My discounts), the referral program with the member's link, then the tier.
 * Points running out soon or on the way get one line above.
 */
export default function LoyaltyMemberBody({ view, member, onOpen }: LoyaltyMemberBodyProps) {
  // Render logic
  const names = view.pointsName
  const usable = member.codes.filter((c) => c.status === 'issued').length
  return (
    <>
      {member.expiringSoon || member.pendingPoints > 0 ? (
        <p className="m-0 flex flex-col gap-0.5 rounded-[0.625rem] border border-(--kl-line) bg-(--kl-surface) px-4 py-3 text-[0.8125rem]">
          {member.expiringSoon ? (
            <span className="font-medium text-(--kl-danger)">
              {copy.expiring(
                copy.points(member.expiringSoon.points, names),
                dayLabel(member.expiringSoon.lastDay),
              )}
            </span>
          ) : null}
          {member.pendingPoints > 0 ? (
            <span className="text-(--kl-muted)">
              {copy.pending(copy.points(member.pendingPoints, names))}
            </span>
          ) : null}
        </p>
      ) : null}
      <LoyaltyNextRewardCard
        rewards={view.rewards}
        points={member.points}
        names={names}
        onClaim={() => onOpen('redeem')}
      />
      <LoyaltyPointsCard
        earnCount={view.waysToEarn.length}
        redeemCount={view.rewards.length}
        discountCount={usable}
        onOpen={onOpen}
      />
      {view.referral ? (
        <LoyaltyReferralCard referral={view.referral} names={names} storeName={view.storeName} />
      ) : null}
      <LoyaltyTierCard tiers={view.tiers} tier={member.tier} names={names} />
    </>
  )
}
