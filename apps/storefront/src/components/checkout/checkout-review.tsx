import { checkoutContent as content } from '@/data/checkout'
import type { ReviewRow } from '@/lib/checkout-filled-rows'
import type { CheckoutSection } from '@/lib/checkout-sections'

type CheckoutReviewProps = {
  rows: ReviewRow[]
  /** Reopen the step a row came from. */
  onChange: (section: CheckoutSection) => void
}

/** What the shopper has told us so far, one row per finished step, each with Change. */
export default function CheckoutReview({ rows, onChange }: CheckoutReviewProps) {
  // Early returns
  if (rows.length === 0) return null

  // Render logic
  return (
    <dl className="m-0! divide-y divide-ck-line rounded-[calc(var(--ck-radius)*1.2)] bg-ck-bg [box-shadow:var(--ck-section-shadow)]">
      {rows.map((row) => (
        <div
          key={row.section}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-[0.875rem] sm:grid-cols-[6rem_minmax(0,1fr)_auto]"
        >
          <dt className="text-ck-muted">{row.label}</dt>
          <dd className="m-0! break-words text-ck-ink">{row.value}</dd>
          <button
            type="button"
            onClick={() => onChange(row.section)}
            aria-label={content.review.changeLabel(row.label)}
            className="-my-3 min-h-11 cursor-pointer rounded-sm text-[0.8125rem]! font-semibold text-ck-muted underline underline-offset-2 outline-none transition-colors duration-150 hover:text-ck-ink focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
          >
            {content.review.change}
          </button>
        </div>
      ))}
    </dl>
  )
}
