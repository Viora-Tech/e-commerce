import type { ReactNode } from 'react'

type LoyaltyCardProps = {
  /** The card's bold heading; none for a card whose title is the panel header. */
  title?: string | undefined
  children: ReactNode
}

/**
 * One white card in the rewards panel (and the Points page): rounded, a hairline border and a
 * soft shadow, so the first cards can sit over the coloured header's bottom edge.
 */
export default function LoyaltyCard({ title, children }: LoyaltyCardProps) {
  // Render logic
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-(--kl-line) bg-(--kl-surface) p-4 shadow-[0_0.25rem_1rem_rgb(0_0_0/0.08)]">
      {title ? <h3 className="m-0 font-[inherit] text-[1rem]! font-bold! leading-tight! tracking-normal! normal-case! text-(--kl-ink)">{title}</h3> : null}
      {children}
    </section>
  )
}
