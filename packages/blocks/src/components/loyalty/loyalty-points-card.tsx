'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import LoyaltyIcon, { type LoyaltyGlyph } from './loyalty-icon'

type LoyaltyPointsCardProps = {
  /** The store has ways to earn / rewards to show; a row without any is left out. */
  canEarn: boolean
  canRedeem: boolean
  onOpen: (screen: 'earn' | 'redeem') => void
}

/**
 * The "Points" card: a line on what points are for, then the "Ways to earn" and "Ways to
 * redeem" rows, each opening its own list inside the panel.
 */
export default function LoyaltyPointsCard({ canEarn, canRedeem, onOpen }: LoyaltyPointsCardProps) {
  // Early returns
  if (!canEarn && !canRedeem) return null

  // Render logic
  const rows: { screen: 'earn' | 'redeem'; label: string; icon: LoyaltyGlyph }[] = [
    ...(canEarn
      ? [{ screen: 'earn' as const, label: copy.pointsCard.earn, icon: 'coins' as const }]
      : []),
    ...(canRedeem
      ? [{ screen: 'redeem' as const, label: copy.pointsCard.redeem, icon: 'gift' as const }]
      : []),
  ]
  return (
    <LoyaltyCard title={copy.pointsCard.title}>
      <p className="m-0 text-(--kl-muted)">{copy.pointsCard.body}</p>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.screen} className="border-t border-(--kl-line) first:border-t-0">
            <button
              type="button"
              onClick={() => onOpen(r.screen)}
              className="flex w-full touch-manipulation items-center gap-3 border-0 bg-transparent px-0 py-3 text-left font-semibold text-(--kl-ink)"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-(--kl-soft)">
                <LoyaltyIcon name={r.icon} className="size-[1.125rem]" />
              </span>
              <span className="min-w-0 flex-1">{r.label}</span>
              <LoyaltyIcon name="chevron-right" className="size-4 shrink-0 text-(--kl-muted)" />
            </button>
          </li>
        ))}
      </ul>
    </LoyaltyCard>
  )
}
