'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { formatPaise } from '../../money'
import LoyaltyCard from './loyalty-card'
import { dayLabel } from './loyalty-format'
import LoyaltyIcon from './loyalty-icon'
import { ICON_TILE } from './loyalty-styles'
import type { LoyaltyMemberView, LoyaltyView } from './loyalty-types'

type LoyaltyBalanceCardProps = {
  view: LoyaltyView
  member: LoyaltyMemberView
}

/**
 * A member's first card, over the header's edge: the balance in large type ("1,250 points"),
 * what it is worth as store credit, and what runs out soon or is on the way.
 */
export default function LoyaltyBalanceCard({ view, member }: LoyaltyBalanceCardProps) {
  // Render logic
  const names = view.pointsName
  const worth = view.pointsAsStoreCredit && member.points > 0
  return (
    <LoyaltyCard>
      <div className="flex items-center gap-3">
        <span className={ICON_TILE}>
          <LoyaltyIcon name="coins" className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[0.8125rem] font-medium text-(--kl-muted)">{copy.balance}</span>
          <span className="text-[1.5rem] font-bold leading-tight text-(--kl-ink) tabular-nums">
            {copy.points(member.points, names)}
          </span>
        </span>
        {worth ? (
          <span className="shrink-0 rounded-full bg-(--kl-tint) px-3 py-1 text-[0.8125rem] font-semibold text-(--kl-accent)">
            {copy.worth(formatPaise(member.points * view.pointPaise))}
          </span>
        ) : null}
      </div>
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
  )
}
