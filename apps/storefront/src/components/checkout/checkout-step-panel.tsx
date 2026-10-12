import type { ReactNode } from 'react'
import { CK_HEADING } from '@/lib/checkout-classes'

type CheckoutStepPanelProps = {
  /** The heading's id; focus moves to it when the step changes (`useCheckoutStep`). */
  headingId: string
  title: string
  intro?: string | null
  children: ReactNode
}

/** One step of the checkout: a plain-spoken question as the heading, a line under it, the fields. */
export default function CheckoutStepPanel({
  headingId,
  title,
  intro = null,
  children,
}: CheckoutStepPanelProps) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2
          id={headingId}
          tabIndex={-1}
          className={`${CK_HEADING} text-[1.5rem]! text-balance outline-none lg:text-[1.75rem]!`}
        >
          {title}
        </h2>
        {intro ? <p className="text-[0.9375rem] text-ck-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  )
}
