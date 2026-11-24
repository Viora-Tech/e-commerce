'use client'

import {
  LoyaltyCodesList,
  LoyaltyEarnList,
  type LoyaltyMemberView,
  LoyaltyReferralCard,
  LoyaltyRewardList,
  LoyaltyTierCard,
  type LoyaltyView,
  loyaltyStyleVars,
  loyaltyWidgetContent,
  recordLoyaltyVisit,
  resolveLoyaltyWidgetSettings,
} from '@commerce/blocks/loyalty'
import { useRouter } from 'next/navigation'
import { type CSSProperties, useEffect } from 'react'

type PointsLoyaltyProps = {
  view: LoyaltyView
  member: LoyaltyMemberView
}

/** The account page draws the widget's cards in their default colours. */
const SETTINGS = resolveLoyaltyWidgetSettings({})

/**
 * The Points page's Loyalty v2 cards (the same ones the widget shows): tier and progress,
 * rewards to claim, the codes already claimed, ways to earn with click-through and the referral
 * link with share buttons. A claim or a click refreshes the page, so the balance and history
 * above follow. Opening the page counts the day's visit.
 */
export default function PointsLoyalty({ view, member }: PointsLoyaltyProps) {
  // Hooks
  const router = useRouter()
  useEffect(() => {
    void recordLoyaltyVisit()
  }, [])

  // Event handlers
  const handleChanged = () => router.refresh()

  // Render logic
  return (
    <div
      className="kl-loyalty flex max-w-[40rem] flex-col gap-4 text-[0.9375rem] text-(--kl-ink)"
      style={loyaltyStyleVars(SETTINGS) as CSSProperties}
    >
      <LoyaltyTierCard tiers={view.tiers} tier={member.tier} names={view.pointsName} />
      <LoyaltyRewardList
        title={loyaltyWidgetContent.rewards.title}
        rewards={view.rewards}
        names={view.pointsName}
        points={member.points}
        onClaimed={handleChanged}
      />
      <LoyaltyCodesList codes={member.codes} />
      <LoyaltyEarnList
        ways={view.waysToEarn}
        names={view.pointsName}
        interactive
        onChanged={handleChanged}
      />
      {view.referral ? (
        <LoyaltyReferralCard
          referral={view.referral}
          names={view.pointsName}
          storeName={view.storeName}
        />
      ) : null}
    </div>
  )
}
