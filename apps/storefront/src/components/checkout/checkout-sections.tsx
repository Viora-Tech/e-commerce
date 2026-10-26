import type { ReactNode } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import { CK_HEADING, CK_LINK } from '@/lib/checkout-classes'
import type { RecapRow } from '@/lib/checkout-recap'
import { type CheckoutStep, stepStatus } from '@/lib/checkout-steps'
import { stepHeadingId } from '@/lib/use-checkout-step'

type CheckoutSectionsProps = {
  steps: readonly CheckoutStep[]
  current: CheckoutStep
  labels: Record<CheckoutStep, string>
  /** What each finished step holds (`recapRows`), shown folded with Change. */
  rows: RecapRow[]
  /** The open card's heading and the line under it. */
  title: string
  intro: string | null
  onChange: (step: CheckoutStep) => void
  /** The open step's fields. */
  children: ReactNode
  /** The open step's error, main button and fine print (`CheckoutPayFooter`). */
  footer: ReactNode
}

/** One card per step: white on the checkout's canvas, a hairline ring and a soft lift. */
const CARD =
  'rounded-[calc(var(--ck-radius)*1.25)] bg-ck-bg [box-shadow:0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.04)] dark:[box-shadow:0_0_0_1px_var(--ck-line)]'

/** The step's number (or a tick once it is done) in a small square, as the admin numbers steps. */
const BADGE =
  'flex size-6 shrink-0 items-center justify-center rounded-[0.5rem] font-mono text-[0.75rem] font-medium'

/**
 * The checkout on one page (Figma Checkout v2, from the admin's look): a numbered card per step
 * (Contact, Address, Delivery, Payment). The step being filled is open with its fields and its
 * button; finished steps fold to one line with Change; later steps wait, greyed, until the
 * earlier ones are done. The step still lives in the URL (`useCheckoutStep`), so back, forward
 * and reload behave and every gate stays as it was.
 */
export default function CheckoutSections({
  steps,
  current,
  labels,
  rows,
  title,
  intro,
  onChange,
  children,
  footer,
}: CheckoutSectionsProps) {
  // Render logic
  const rowOf = (step: CheckoutStep) => rows.find((r) => r.step === step) ?? null

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => {
        const number = i + 1
        const status = stepStatus(step, current, steps)
        if (status === 'current') {
          return (
            <section
              key={step}
              aria-labelledby={stepHeadingId(step)}
              aria-current="step"
              className={`${CARD} flex flex-col gap-6 p-5 sm:p-6`}
            >
              <div className="flex flex-col gap-1.5">
                <h2
                  id={stepHeadingId(step)}
                  tabIndex={-1}
                  className={`${CK_HEADING} flex items-center gap-2.5 text-[1.125rem]! outline-none sm:text-[1.25rem]!`}
                >
                  <span className={`${BADGE} bg-ck-button text-ck-button-ink`}>{number}</span>
                  {title}
                </h2>
                {intro ? (
                  <p className="pl-[2.125rem] text-[0.875rem] text-pretty text-ck-muted">{intro}</p>
                ) : null}
              </div>
              {children}
              {footer}
            </section>
          )
        }
        const row = status === 'done' ? rowOf(step) : null
        if (row) {
          return (
            <section
              key={step}
              aria-label={labels[step]}
              className={`${CARD} flex items-start gap-3 px-5 py-4 sm:px-6`}
            >
              <span className={`${BADGE} bg-ck-soft text-ck-success`}>
                <CheckoutIcon name="check" className="size-3.5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 className={`${CK_HEADING} text-[0.9375rem]!`}>{labels[step]}</h2>
                <p className="text-[0.875rem] text-ck-muted [overflow-wrap:anywhere]">
                  {row.value}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(step)}
                aria-label={row.changeLabel}
                className={`${CK_LINK} shrink-0`}
              >
                {content.recap.change}
              </button>
            </section>
          )
        }
        return (
          <section
            key={step}
            aria-label={labels[step]}
            aria-disabled="true"
            className={`${CARD} flex items-center gap-3 px-5 py-4 sm:px-6`}
          >
            <span className={`${BADGE} bg-ck-soft text-ck-muted`}>{number}</span>
            <h2 className={`${CK_HEADING} text-[0.9375rem]! text-ck-muted!`}>{labels[step]}</h2>
          </section>
        )
      })}
    </div>
  )
}
