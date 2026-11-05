import { Fragment } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import type { CheckoutSection } from '@/lib/checkout-sections'

type CheckoutStepperProps = {
  sections: readonly CheckoutSection[]
  current: CheckoutSection
  /** Each step's name: the store's own wording. */
  label: (section: CheckoutSection) => string
  /** Go back to a finished step. */
  onPick: (section: CheckoutSection) => void
}

/**
 * The steps, close together, with one long line that follows the shopper: it sits after the
 * current step, so moving on closes that gap and opens the next (300ms ease-out). On the last
 * step it sits before it. On a phone only the current step keeps its name, so all fit on a line.
 */
export default function CheckoutStepper({
  sections,
  current,
  label,
  onPick,
}: CheckoutStepperProps) {
  // Render logic
  const at = sections.indexOf(current)
  const last = sections.length - 1
  const longLine = at === last ? last - 1 : at

  return (
    <nav aria-label={content.stepsLabel}>
      <ol className="m-0! flex list-none items-center gap-1.5 p-0! lg:gap-2.5">
        {sections.map((section, i) => {
          const done = i < at
          const here = i === at
          const mark = (
            <>
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold tabular-nums ${done || here ? 'bg-ck-accent text-ck-accent-ink' : 'border border-ck-line text-ck-muted'}`}
              >
                {done ? <CheckoutIcon name="check" className="size-3.5" /> : i + 1}
              </span>
              <span
                className={`text-[0.8125rem] whitespace-nowrap ${here ? 'font-semibold text-ck-ink' : 'hidden font-medium lg:inline'} ${done ? 'text-ck-muted' : ''} ${!done && !here ? 'text-ck-muted/70' : ''}`}
              >
                {label(section)}
              </span>
            </>
          )

          return (
            <Fragment key={section}>
              <li className="flex shrink-0 items-center" aria-current={here ? 'step' : undefined}>
                {done ? (
                  <button
                    type="button"
                    onClick={() => onPick(section)}
                    aria-label={content.stepsBackTo(label(section))}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-ck outline-none focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)]"
                  >
                    {mark}
                  </button>
                ) : (
                  <span className="flex min-h-11 items-center gap-2">{mark}</span>
                )}
              </li>
              {i < last ? (
                <li
                  aria-hidden="true"
                  className={`h-0.5 min-w-2.5 basis-2.5 rounded-full transition-[flex-grow] duration-300 ease-out motion-reduce:transition-none lg:min-w-3.5 lg:basis-3.5 ${i === longLine ? 'grow' : 'grow-0'} ${i < at ? 'bg-ck-accent' : i === longLine ? 'bg-linear-to-r from-ck-accent to-ck-line' : 'bg-ck-line'}`}
                />
              ) : null}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
