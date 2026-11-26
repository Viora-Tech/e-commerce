'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import LoyaltyIcon, { type LoyaltyGlyph } from './loyalty-icon'
import { ICON_TILE } from './loyalty-styles'

type LoyaltyPointsCardProps = {
  /** How many ways to earn / rewards the store offers; a row with none is left out. */
  earnCount: number
  redeemCount: number
  onOpen: (screen: 'earn' | 'redeem') => void
}

/**
 * The "Points" card: a line on what points are for, then the "Ways to earn" and "Ways to
 * redeem" rows (icon, label, how many, chevron), each opening its own list inside the panel.
 */
export default function LoyaltyPointsCard({
  earnCount,
  redeemCount,
  onOpen,
}: LoyaltyPointsCardProps) {
  // Early returns
  if (earnCount === 0 && redeemCount === 0) return null

  // Render logic
  const rows: { screen: 'earn' | 'redeem'; label: string; meta: string; icon: LoyaltyGlyph }[] = [
    ...(earnCount > 0
      ? [
          {
            screen: 'earn' as const,
            label: copy.pointsCard.earn,
            meta: copy.pointsCard.earnMeta(earnCount),
            icon: 'coins' as const,
          },
        ]
      : []),
    ...(redeemCount > 0
      ? [
          {
            screen: 'redeem' as const,
            label: copy.pointsCard.redeem,
            meta: copy.pointsCard.redeemMeta(redeemCount),
            icon: 'gift' as const,
          },
        ]
      : []),
  ]
  return (
    <LoyaltyCard title={copy.pointsCard.title} intro={copy.pointsCard.body}>
      <ul className="m-0 -mx-1 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.screen} className="border-t border-(--kl-line) first:border-t-0">
            <button
              type="button"
              onClick={() => onOpen(r.screen)}
              className="flex w-full touch-manipulation items-center gap-3 rounded-xl border-0 bg-transparent px-1 py-2.5 text-left text-(--kl-ink) hover:bg-(--kl-soft)"
            >
              <span className={ICON_TILE}>
                <LoyaltyIcon name={r.icon} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{r.label}</span>
                <span className="text-[0.8125rem] text-(--kl-muted)">{r.meta}</span>
              </span>
              <LoyaltyIcon name="chevron-right" className="size-4 shrink-0 text-(--kl-muted)" />
            </button>
          </li>
        ))}
      </ul>
    </LoyaltyCard>
  )
}
