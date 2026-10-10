import { formatPaise } from '@commerce/blocks'
import { formatInZone } from '@commerce/dates'
import type { CheckoutSession } from '@commerce/payments'
import TransferInstructions from '@/components/checkout/transfer-instructions'
import { balanceContent as content } from '@/data/checkout'
import { payBalanceAction } from '@/lib/balance-actions'
import { CK_BUTTON_PRIMARY, CK_HEADING } from '@/lib/checkout-classes'
import type { BalanceView } from '@/lib/preorder'

type CheckoutBalanceProps = {
  orderNumber: number
  /** The order's view token; "Pay balance" proves access with it, never the number alone. */
  viewToken: string
  balance: BalanceView
  /** The open balance attempt's session, when it is a transfer waiting on the shopper. */
  session?: CheckoutSession | null | undefined
  timeZone?: string | undefined
}

/**
 * A deposit pre-order's balance on the thank-you and pay-balance pages, in the checkout's
 * look: what was paid, what is owed, by when, and the "Pay balance" button.
 */
export default function CheckoutBalance({
  orderNumber,
  viewToken,
  balance,
  session,
  timeZone = 'Asia/Kolkata',
}: CheckoutBalanceProps) {
  // Render logic
  const owed = formatPaise(balance.owedPaise)
  const manual = session?.kind === 'manual' ? session.instructions : null

  return (
    <section
      aria-labelledby="balance-due-heading"
      className="flex flex-col gap-4 rounded-ck border border-ck-line bg-ck-field p-5 sm:p-6"
    >
      <h2 id="balance-due-heading" className={`${CK_HEADING} text-[1.0625rem]!`}>
        {content.heading}
      </h2>
      <dl className="flex flex-col gap-2 text-[0.875rem]">
        <div className="flex justify-between gap-4">
          <dt className="text-ck-muted">{content.paidLabel}</dt>
          <dd className="tabular-nums">{formatPaise(balance.paidPaise)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-ck-line pt-2 text-[1rem] font-semibold">
          <dt>{content.dueLabel}</dt>
          <dd className="tabular-nums">{owed}</dd>
        </div>
      </dl>
      {balance.payBy ? (
        <p className="text-[0.8125rem] text-ck-muted">
          {content.payBy(formatInZone(balance.payBy, { dateStyle: 'medium' }, { timeZone }))}
        </p>
      ) : null}
      {balance.nonRefundableDays ? (
        <p className="text-[0.8125rem] text-ck-muted">
          {content.nonRefundable(balance.nonRefundableDays)}
        </p>
      ) : null}
      {manual ? <TransferInstructions instructions={manual} amountLabel={owed} /> : null}
      <form action={payBalanceAction.bind(null, orderNumber, viewToken)}>
        <button type="submit" className={CK_BUTTON_PRIMARY}>
          {content.pay(owed)}
        </button>
      </form>
    </section>
  )
}
