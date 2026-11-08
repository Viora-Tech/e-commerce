'use client'

import { CK_BUTTON_PRIMARY, CK_BUTTON_SECONDARY, CK_LINK } from '@/lib/checkout-classes'
import type { CheckoutProblem } from '@/lib/checkout-result'

type CheckoutRepeatNoticeProps = {
  /** The form's last problem; only a refusal with links or an "Order again?" question shows here. */
  problem: CheckoutProblem | null
  /** "Yes, order again": the same submit, told the shopper meant it. */
  onOrderAgain: () => void
  pending: boolean
}

/**
 * Under the checkout's error line: the links to the shopper's earlier order ("Complete
 * payment", "Change payment method"), or the "Order again?" question with "View my order"
 * and "Yes, order again". Pressing Pay again asks again: only the button places a second order.
 */
export default function CheckoutRepeatNotice({
  problem,
  onOrderAgain,
  pending,
}: CheckoutRepeatNoticeProps) {
  // Render logic
  if (problem === null || typeof problem === 'string') return null
  const ask = 'confirmAgain' in problem ? problem.confirmAgain : null
  const links = 'confirmAgain' in problem ? problem.confirmAgain.links : (problem.links ?? [])
  if (!ask && links.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-ck border border-ck-line bg-ck-soft px-4 py-3 text-[0.875rem] leading-snug text-ck-ink">
      {ask ? <p className="font-semibold">{ask.message}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        {links.map((l) => (
          <a key={l.label} href={l.href} className={ask ? CK_BUTTON_SECONDARY : CK_LINK}>
            {l.label}
          </a>
        ))}
        {ask ? (
          <button
            type="button"
            className={CK_BUTTON_PRIMARY}
            disabled={pending}
            onClick={onOrderAgain}
          >
            {ask.orderAgain}
          </button>
        ) : null}
      </div>
    </div>
  )
}
