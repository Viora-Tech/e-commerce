import type { ReactNode } from 'react'
import { CK_HEADING } from '@/lib/checkout-classes'

type ThankYouCardProps = {
  /** Ties the heading to the section for screen readers. */
  id: string
  title: string
  children: ReactNode
}

/**
 * One white card on the thank-you page's canvas, as the checkout's step cards: a hairline
 * ring and a soft lift in light mode (`--ck-card-shadow`), a plain ring in dark.
 */
export default function ThankYouCard({ id, title, children }: ThankYouCardProps) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-5 rounded-[calc(var(--ck-radius)*1.25)] bg-ck-bg p-5 [box-shadow:var(--ck-card-shadow)] sm:p-6 dark:[box-shadow:0_0_0_1px_var(--ck-line)]"
    >
      <h2 id={id} className={`${CK_HEADING} text-[1.125rem]! sm:text-[1.25rem]!`}>
        {title}
      </h2>
      {children}
    </section>
  )
}
