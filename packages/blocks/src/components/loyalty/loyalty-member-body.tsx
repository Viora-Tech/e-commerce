'use client'

import LoyaltyBalanceCard from './loyalty-balance-card'
import LoyaltyCodesList from './loyalty-codes-list'
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
 * The panel for a signed-in member: the balance over the header's edge, the Points card that
 * opens the ways to earn and the rewards to claim, the tier card, "Your rewards" (codes already
 * claimed) and the referral program's Give / Get with their link and share buttons.
 */
export default function LoyaltyMemberBody({ view, member, onOpen }: LoyaltyMemberBodyProps) {
  // Render logic
  return (
    <>
      <LoyaltyBalanceCard view={view} member={member} />
      <LoyaltyPointsCard
        earnCount={view.waysToEarn.length}
        redeemCount={view.rewards.length}
        onOpen={onOpen}
      />
      <LoyaltyTierCard tiers={view.tiers} tier={member.tier} names={view.pointsName} />
      <LoyaltyCodesList codes={member.codes} />
      {view.referral ? (
        <LoyaltyReferralCard
          referral={view.referral}
          names={view.pointsName}
          storeName={view.storeName}
        />
      ) : null}
    </>
  )
}
