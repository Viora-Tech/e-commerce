import { thankYouContent as content } from '@/data/checkout'
import { THANK_YOU_STEPS } from '@/lib/thank-you'

type OrderProgressProps = {
  /** Index into `THANK_YOU_STEPS` of the step the order reached. */
  reached: number
}

/**
 * Confirmed / Packed / Shipped / Delivered as four segments: the steps the order reached are
 * filled in the accent, the rest wait in the soft grey, each with its label under it.
 */
export default function OrderProgress({ reached }: OrderProgressProps) {
  return (
    <ol aria-label={content.progress.label} className="grid grid-cols-4 gap-1.5">
      {THANK_YOU_STEPS.map((step, i) => (
        <li
          key={step}
          aria-current={i === reached ? 'step' : undefined}
          className="flex min-w-0 flex-col gap-2"
        >
          <span
            aria-hidden="true"
            className={`h-1.5 rounded-full ${i <= reached ? 'bg-ck-accent' : 'bg-ck-soft dark:bg-ck-line'}`}
          />
          <span
            className={`truncate text-[0.8125rem] ${i <= reached ? 'font-medium text-ck-ink' : 'text-ck-muted'}`}
          >
            {content.progress.steps[step]}
          </span>
        </li>
      ))}
    </ol>
  )
}
