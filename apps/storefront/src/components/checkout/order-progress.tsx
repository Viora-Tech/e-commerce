import { Fragment } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { thankYouContent as content } from '@/data/checkout'
import { THANK_YOU_STEPS } from '@/lib/thank-you'

type OrderProgressProps = {
  /** Index into `THANK_YOU_STEPS` of the step the order reached; below zero for none yet. */
  reached: number
}

/** The step's name: strongest where the order is, and on a phone only that one keeps its name. */
function labelClass(i: number, reached: number): string {
  if (i === reached) return 'font-semibold text-ck-ink'
  return `font-medium max-sm:sr-only ${i < reached ? 'text-ck-ink' : 'text-ck-faint'}`
}

/**
 * Confirmed / Packed / Shipped / Delivered in one line: a green tick on the steps the order
 * reached, an empty ring on the rest, joined by short lines, so the row never wraps on a phone.
 */
export default function OrderProgress({ reached }: OrderProgressProps) {
  return (
    <ol aria-label={content.progress.label} className="m-0! flex items-center gap-2 p-0!">
      {THANK_YOU_STEPS.map((step, i) => (
        <Fragment key={step}>
          {i > 0 ? (
            <li aria-hidden="true" className="h-0.5 min-w-2 flex-1 rounded-full bg-ck-line" />
          ) : null}
          <li
            aria-current={i === reached ? 'step' : undefined}
            className="flex shrink-0 items-center gap-1.5"
          >
            {i <= reached ? (
              <span className="grid size-4 place-items-center rounded-full bg-ck-success text-ck-bg">
                <CheckoutIcon name="check" className="size-2.5" />
              </span>
            ) : (
              <span className="size-4 rounded-full border-[0.09375rem] border-ck-line-strong" />
            )}
            <span className={`text-[0.75rem] leading-[1.0625rem] ${labelClass(i, reached)}`}>
              {content.progress.steps[step]}
            </span>
          </li>
        </Fragment>
      ))}
    </ol>
  )
}
