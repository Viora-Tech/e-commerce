'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import LoyaltyIcon, { type LoyaltyGlyph } from './loyalty-icon'
import { ROW_BUTTON } from './loyalty-styles'

export type LoyaltyScreen = 'earn' | 'redeem' | 'discounts'

type LoyaltyPointsCardProps = {
  /** How many ways to earn / rewards the store offers; a row with none is left out. */
  earnCount: number
  redeemCount: number
  /** A member: the "My discounts" row (claimed codes); null for a visitor. */
  discountCount: number | null
  onOpen: (screen: LoyaltyScreen) => void
}

type Row = { screen: LoyaltyScreen; label: string; icon: LoyaltyGlyph }

/**
 * The "Points" card: a centred line on what points are for, then the rows that open their own
 * screen: Ways to earn (hand and coin), Ways to redeem (gift) and, for a member, My discounts
 * (ticket). Icons in the brand colour, a chevron at the end, hairlines between rows.
 */
export default function LoyaltyPointsCard({
  earnCount,
  redeemCount,
  discountCount,
  onOpen,
}: LoyaltyPointsCardProps) {
  // Render logic
  const rows: Row[] = []
  if (earnCount > 0) rows.push({ screen: 'earn', label: copy.pointsCard.earn, icon: 'hand-coin' })
  if (redeemCount > 0) rows.push({ screen: 'redeem', label: copy.pointsCard.redeem, icon: 'gift' })
  if (discountCount !== null)
    rows.push({ screen: 'discounts', label: copy.pointsCard.discounts, icon: 'ticket' })
  if (rows.length === 0) return null
  return (
    <LoyaltyCard title={copy.pointsCard.title} intro={copy.pointsCard.body}>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.screen} className="border-t border-(--kl-line) first:border-t-0">
            <button type="button" onClick={() => onOpen(r.screen)} className={ROW_BUTTON}>
              <LoyaltyIcon name={r.icon} className="size-6 shrink-0 text-(--kl-accent)" />
              <span className="min-w-0 flex-1">{r.label}</span>
              {r.screen === 'discounts' && discountCount ? (
                <span className="rounded-full bg-(--kl-tint) px-2 py-0.5 text-[0.75rem] font-semibold text-(--kl-accent)">
                  {discountCount}
                </span>
              ) : null}
              <LoyaltyIcon name="chevron-right" className="size-4 shrink-0 text-(--kl-muted)" />
            </button>
          </li>
        ))}
      </ul>
    </LoyaltyCard>
  )
}
