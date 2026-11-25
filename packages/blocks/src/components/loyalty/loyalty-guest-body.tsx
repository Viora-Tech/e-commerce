'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import { offerLabel } from './loyalty-format'
import LoyaltyJoin from './loyalty-join'
import LoyaltyPointsCard from './loyalty-points-card'
import type { LoyaltyView } from './loyalty-types'

type LoyaltyGuestBodyProps = {
  view: LoyaltyView
  onOpen: (screen: 'earn' | 'redeem') => void
}

/**
 * The panel for a visitor who is not signed in: "Become a member" (signing in creates the
 * account), the Points card that opens the ways to earn and redeem, and what a friend gets
 * from a referral.
 */
export default function LoyaltyGuestBody({ view, onOpen }: LoyaltyGuestBodyProps) {
  // Render logic
  return (
    <>
      <LoyaltyCard title={copy.guest.heading}>
        <p className="m-0 text-(--kl-muted)">{copy.guest.body}</p>
        <LoyaltyJoin />
      </LoyaltyCard>
      <LoyaltyPointsCard
        canEarn={view.waysToEarn.length > 0}
        canRedeem={view.rewards.length > 0}
        onOpen={onOpen}
      />
      {view.referral ? (
        <LoyaltyCard title={copy.referral.title}>
          <p className="m-0 text-(--kl-muted)">
            {copy.referral.teaser(offerLabel(view.referral.friendReward, view.pointsName))}
          </p>
        </LoyaltyCard>
      ) : null}
    </>
  )
}
