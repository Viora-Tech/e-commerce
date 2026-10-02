import type { ReactNode } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import { CK_HEADING } from '@/lib/checkout-classes'

type CheckoutSectionProps = {
  id: string
  step: number
  steps: number
  title: string
  /** Everything in the step is filled in and checks out: the number turns into a tick. */
  done?: boolean
  /** Beside the heading, e.g. "Sign in" in the contact step. */
  aside?: ReactNode
  children: ReactNode
}

/**
 * One step of the one-page checkout. Steps read top to bottom (contact, delivery,
 * delivery method, payment); none is hidden behind another, so the shopper sees
 * everything and can change any of it before paying.
 */
export default function CheckoutSection({
  id,
  step,
  steps,
  title,
  done = false,
  aside = null,
  children,
}: CheckoutSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-6 flex-col gap-5 border-b border-ck-line pt-3 pb-9 last-of-type:border-b-0"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none ${done ? 'bg-ck-accent text-ck-accent-ink' : 'border border-ck-line text-ck-muted'}`}
          >
            {done ? <CheckoutIcon name="check" className="size-3.5" /> : step}
          </span>
          <h2 id={`${id}-title`} className={`${CK_HEADING} text-[1.125rem]!`}>
            <span className="sr-only">{content.step(step, steps)}: </span>
            {title}
            {done ? <span className="sr-only">, {content.stepDone}</span> : null}
          </h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}
