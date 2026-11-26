'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import LoyaltyJoin from './loyalty-join'
import LoyaltyPointsCard, { type LoyaltyScreen } from './loyalty-points-card'
import LoyaltyReferralCard from './loyalty-referral-card'
import type { LoyaltyView } from './loyalty-types'

type LoyaltyGuestBodyProps = {
  view: LoyaltyView
  onOpen: (screen: LoyaltyScreen) => void
}

/**
 * The panel for a visitor who is not signed in, in Essential Loyalty's order: "Become a member"
 * over the header's fade (Join now, or Sign in; signing in creates the account), the Points card
 * that opens Ways to earn and Ways to redeem, and the referral program when the store runs one.
 */
export default function LoyaltyGuestBody({ view, onOpen }: LoyaltyGuestBodyProps) {
  // Render logic
  return (
    <>
      <LoyaltyCard title={copy.guest.heading} intro={copy.guest.body}>
        <LoyaltyJoin />
      </LoyaltyCard>
      <LoyaltyPointsCard
        earnCount={view.waysToEarn.length}
        redeemCount={view.rewards.length}
        discountCount={null}
        onOpen={onOpen}
      />
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
