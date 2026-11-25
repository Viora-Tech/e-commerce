'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { formatPaise } from '../../money'
import LoyaltyCard from './loyalty-card'
import LoyaltyCodesList from './loyalty-codes-list'
import { dayLabel } from './loyalty-format'
import LoyaltyPointsCard from './loyalty-points-card'
import LoyaltyReferralCard from './loyalty-referral-card'
import LoyaltyTierCard from './loyalty-tier-card'
import type { LoyaltyMemberView, LoyaltyView } from './loyalty-types'

type LoyaltyMemberBodyProps = {
  view: LoyaltyView
  member: LoyaltyMemberView
  onOpen: (screen: 'earn' | 'redeem') => void
}

/**
 * The panel for a signed-in member (the header above shows the balance): what the points are
 * worth, what runs out soon and what is on the way (when any), the Points card that opens the ways to earn and the rewards to
 * claim, the tier card, the codes already claimed, and the referral link with share buttons.
 */
export default function LoyaltyMemberBody({ view, member, onOpen }: LoyaltyMemberBodyProps) {
  // Render logic
  const names = view.pointsName
  const worth = view.pointsAsStoreCredit && member.points > 0
  const extras = worth || !!member.expiringSoon || member.pendingPoints > 0
  return (
    <>
      {extras ? (
        <LoyaltyCard>
          {worth ? (
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
        </LoyaltyCard>
      ) : null}
      <LoyaltyPointsCard
        canEarn={view.waysToEarn.length > 0}
        canRedeem={view.rewards.length > 0}
        onOpen={onOpen}
      />
      <LoyaltyTierCard tiers={view.tiers} tier={member.tier} names={names} />
      <LoyaltyCodesList codes={member.codes} />
      {view.referral ? (
        <LoyaltyReferralCard referral={view.referral} names={names} storeName={view.storeName} />
      ) : null}
    </>
  )
}
