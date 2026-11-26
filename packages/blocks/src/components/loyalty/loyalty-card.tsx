import type { ReactNode } from 'react'
import { CARD_HEADING } from './loyalty-styles'

type LoyaltyCardProps = {
  /** The card's bold heading, centred; none for a list card under a screen title. */
  title?: string | undefined
  /** A short line under the heading, centred. */
  intro?: string | undefined
  children: ReactNode
}

/**
 * One white card in the rewards panel (and the landing page), Essential Loyalty's way: a
 * hairline border, gently rounded, the heading and its line centred, the rows full width.
 */
export default function LoyaltyCard({ title, intro, children }: LoyaltyCardProps) {
  // Render logic
  return (
    <section className="flex flex-col gap-3 rounded-[0.625rem] border border-(--kl-line) bg-(--kl-surface) px-4 py-4 shadow-[0_0.125rem_0.5rem_rgb(0_0_0/0.04)]">
      {title || intro ? (
        <div className="flex flex-col items-center gap-2 text-center">
          {title ? <h3 className={CARD_HEADING}>{title}</h3> : null}
          {intro ? (
            <p className="m-0 text-[0.875rem] leading-normal text-(--kl-muted)">{intro}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
