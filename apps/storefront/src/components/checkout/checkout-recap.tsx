import { checkoutContent as content } from '@/data/checkout'
import { CK_LINK } from '@/lib/checkout-classes'
import type { RecapRow } from '@/lib/checkout-recap'
import type { CheckoutStep } from '@/lib/checkout-steps'

type CheckoutRecapProps = {
  rows: RecapRow[]
  onChange: (step: CheckoutStep) => void
}

/**
 * What the finished steps hold, above the current one ("Contact", "Ship to", "Delivery"),
 * each with Change to go back to its step. Nothing is retyped: the form keeps every value.
 */
export default function CheckoutRecap({ rows, onChange }: CheckoutRecapProps) {
  // Early returns
  if (rows.length === 0) return null

  return (
    <section aria-label={content.recap.heading}>
      <dl className="divide-y divide-ck-line rounded-ck border border-ck-line bg-ck-field">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline gap-4 px-4 py-3 text-[0.875rem]">
            <dt className="w-[4.5rem] shrink-0 text-ck-muted">{r.label}</dt>
            <dd className="min-w-0 flex-1 text-ck-ink [overflow-wrap:anywhere]">{r.value}</dd>
            <dd className="shrink-0">
              <button
                type="button"
                onClick={() => onChange(r.step)}
                aria-label={r.changeLabel}
                className={`${CK_LINK} underline!`}
              >
                {content.recap.change}
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
