import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import { type CheckoutStep, stepStatus } from '@/lib/checkout-steps'

type CheckoutProgressProps = {
  steps: readonly CheckoutStep[]
  current: CheckoutStep
  labels: Record<CheckoutStep, string>
  /** Finished steps the shopper may go back to. */
  onGo: (step: CheckoutStep) => void
}

/**
 * Where the shopper is: numbered steps joined by a line on a computer, "Step 1 of 3 ·
 * Address" over a segmented bar on a phone. A finished step is a button back to it; the
 * current one carries `aria-current="step"`.
 */
export default function CheckoutProgress({ steps, current, labels, onGo }: CheckoutProgressProps) {
  // Render logic
  const at = steps.indexOf(current)

  return (
    <nav aria-label={content.steps.progress}>
      <div className="flex flex-col gap-2.5 lg:hidden">
        <p className="text-[0.8125rem] text-ck-muted">
          {content.step(at + 1, steps.length)}
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-ck-ink">{labels[current]}</span>
        </p>
        <div aria-hidden="true" className="grid auto-cols-fr grid-flow-col gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s}
              className={`h-1 rounded-full transition-colors duration-200 motion-reduce:transition-none ${i <= at ? 'bg-ck-accent' : 'bg-ck-line'}`}
            />
          ))}
        </div>
      </div>
      <ol className="hidden items-center gap-3 lg:flex">
        {steps.map((s, i) => {
          const status = stepStatus(s, current, steps)
          const marker = (
            <>
              <span
                aria-hidden="true"
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none ${status === 'upcoming' ? 'border border-ck-line bg-ck-field text-ck-muted' : 'bg-ck-accent text-ck-accent-ink'}`}
              >
                {status === 'done' ? <CheckoutIcon name="check" className="size-3.5" /> : i + 1}
              </span>
              <span className="flex flex-col text-left leading-tight">
                <span className="text-[0.75rem] text-ck-muted">
                  {content.step(i + 1, steps.length)}
                </span>
                <span
                  className={`text-[0.9375rem] font-medium ${status === 'upcoming' ? 'text-ck-muted' : 'text-ck-ink'}`}
                >
                  {labels[s]}
                  {status === 'done' ? <span className="sr-only">, {content.stepDone}</span> : null}
                </span>
              </span>
            </>
          )
          return (
            <li key={s} className="flex min-w-0 flex-1 items-center gap-3 last:flex-none">
              {status === 'done' ? (
                <button
                  type="button"
                  onClick={() => onGo(s)}
                  aria-label={content.steps.goTo(labels[s])}
                  className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-ck bg-transparent! p-0! outline-none focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)]"
                >
                  {marker}
                </button>
              ) : (
                <span
                  aria-current={status === 'current' ? 'step' : undefined}
                  className="flex shrink-0 items-center gap-2.5"
                >
                  {marker}
                </span>
              )}
              {i < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`min-w-6 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none ${status === 'done' ? 'h-0.5 bg-ck-accent' : 'h-px bg-ck-line'}`}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
