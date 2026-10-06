import { formatPaise } from '@commerce/blocks'
import type { CheckoutSession } from '@commerce/payments'
import { balanceContent as content } from '@/data/checkout'
import { payBalanceAction } from '@/lib/balance-actions'
import type { BalanceView } from '@/lib/preorder'
import ManualPaymentInstructions from './manual-payment-instructions'

type BalanceDueProps = {
  orderNumber: number
  /** The order's view token; "Pay balance" proves access with it, never the number alone. */
  viewToken: string
  balance: BalanceView
  /** The open balance attempt's session, when it is a transfer waiting on the shopper. */
  session?: CheckoutSession | null | undefined
  timeZone?: string | undefined
}

const formatDate = (d: Date, timeZone: string) =>
  d.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone })

/** A deposit pre-order's balance: what was paid, what is owed, and the "Pay balance" button. */
export default function BalanceDue({
  orderNumber,
  viewToken,
  balance,
  session,
  timeZone = 'Asia/Kolkata',
}: BalanceDueProps) {
  // Render logic
  const owed = formatPaise(balance.owedPaise)
  const manual = session?.kind === 'manual' ? session.instructions : null

  return (
    <section className="cart-summary balance-due" aria-labelledby="balance-due-heading">
      <h2 id="balance-due-heading" className="cart-summary__heading h4">
        {content.heading}
      </h2>
      <div className="cart-summary__row">
        <span>{content.paid(formatPaise(balance.paidPaise))}</span>
      </div>
      <div className="cart-summary__row cart-summary__row--total">
        <span>{content.due(owed)}</span>
      </div>
      {balance.payBy ? (
        <p className="text-small">{content.payBy(formatDate(balance.payBy, timeZone))}</p>
      ) : null}
      {balance.nonRefundableDays ? (
        <p className="text-small">{content.nonRefundable(balance.nonRefundableDays)}</p>
      ) : null}
      {manual ? <ManualPaymentInstructions instructions={manual} amountLabel={owed} /> : null}
      <form action={payBalanceAction.bind(null, orderNumber, viewToken)}>
        <button type="submit" className="btn btn--primary">
          {content.pay(owed)}
        </button>
      </form>
    </section>
  )
}
