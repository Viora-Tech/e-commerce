import type { ReactNode } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import { CK_CARD, CK_HEADING } from '@/lib/checkout-classes'

type CheckoutCardProps = {
  /** The DOM id Pay scrolls to (`sectionDomId`). */
  id: string
  headingId: string
  /** 1 Contact, 2 Delivery…; null for the unnumbered Express card. */
  number: number | null
  title: string
  /** This card's part is filled in: the number turns into a tick. */
  done?: boolean
  /** Right of the heading: "Sign in", "To 122001", "Encrypted and secure". */
  aside?: ReactNode
  children: ReactNode
}

/**
 * One numbered card of the one-page checkout (design: checkout-design Main/Mobile): a white
 * card on the canvas, a small square number and the heading, then the fields. When its part
 * is filled in the number cross-fades to a tick (opacity and scale, 200ms ease-out; a fade
 * only with reduced motion), so the shopper sees the page fill up without being moved on.
 */
export default function CheckoutCard({
  id,
  headingId,
  number,
  title,
  done = false,
  aside = null,
  children,
}: CheckoutCardProps) {
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className={`${CK_CARD} flex scroll-mt-4 flex-col gap-3 p-4 outline-none sm:gap-3.5 sm:p-5`}
    >
      <div className="flex min-h-6 items-center justify-between gap-4">
        <h2
          id={headingId}
          className={`${CK_HEADING} flex items-center gap-2 text-[0.9375rem]! font-bold! sm:gap-2.5 sm:text-[1rem]!`}
        >
          {number === null ? null : (
            <span
              aria-hidden="true"
              className={`grid size-[1.375rem] shrink-0 place-items-center rounded-[0.4375rem] font-mono text-[0.6875rem] font-medium transition-[background-color] duration-200 ease-out motion-reduce:transition-none sm:size-6 sm:rounded-[0.5rem] sm:text-[0.75rem] ${done ? 'bg-ck-success text-ck-bg' : 'bg-ck-button text-ck-button-ink'}`}
            >
              <span
                className={`col-start-1 row-start-1 transition-[opacity,scale] duration-200 ease-out motion-reduce:scale-100 ${done ? 'scale-[0.6] opacity-0' : 'scale-100 opacity-100'}`}
              >
                {number}
              </span>
              <CheckoutIcon
                name="check"
                className={`col-start-1 row-start-1 size-3.5 transition-[opacity,scale] duration-200 ease-out motion-reduce:scale-100 ${done ? 'scale-100 opacity-100' : 'scale-[0.6] opacity-0'}`}
              />
            </span>
          )}
          {title}
          {done ? <span className="sr-only">{content.sections.done}</span> : null}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
