import type { ReactNode } from 'react'
import { CARD_HEADING } from './loyalty-styles'

type LoyaltyCardProps = {
  /** The card's bold heading; none for a card whose title is the panel header. */
  title?: string | undefined
  /** A short line under the heading. */
  intro?: string | undefined
  children: ReactNode
}

/**
 * One white card in the rewards panel (and the Points page): well rounded, a hairline border and
 * a soft shadow, so the first card can sit over the coloured header's bottom edge.
 */
export default function LoyaltyCard({ title, intro, children }: LoyaltyCardProps) {
  // Render logic
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-(--kl-line) bg-(--kl-surface) p-4 shadow-[0_0.375rem_1.25rem_rgb(0_0_0/0.08)]">
      {title || intro ? (
        <div className="flex flex-col gap-1">
          {title ? <h3 className={CARD_HEADING}>{title}</h3> : null}
          {intro ? <p className="m-0 text-[0.875rem] text-(--kl-muted)">{intro}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
