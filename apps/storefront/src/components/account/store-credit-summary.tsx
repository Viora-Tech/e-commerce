import { formatPaise } from '@commerce/blocks'
import Link from 'next/link'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { accountContent } from '@/data/account'
import { ACCOUNT_CARD, ACCOUNT_LINK } from '@/lib/account-classes'

type StoreCreditSummaryProps = {
  /** What the shopper can spend now; the card is not drawn at zero. */
  balancePaise: number
}

const copy = accountContent.storeCredit

/**
 * The store credit card at the top of the Orders page: the balance to spend and a link to its
 * history, so a refund to store credit is seen without opening the Store credit section.
 */
export default function StoreCreditSummary({ balancePaise }: StoreCreditSummaryProps) {
  // Early returns
  if (balancePaise <= 0) return null

  // Render logic
  return (
    <section
      className={`${ACCOUNT_CARD} mb-4 flex-row! items-center gap-3! sm:mb-5`}
      aria-labelledby="credit-summary"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ck-accent-soft text-ck-accent">
        <CheckoutIcon name="gift" className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p id="credit-summary" className="text-[0.8125rem] font-medium text-ck-muted">
          {copy.summaryTitle}
        </p>
        <p className="text-[1.25rem] font-bold leading-tight tabular-nums text-ck-ink">
          {formatPaise(balancePaise)}
        </p>
        <p className="text-[0.8125rem] text-ck-muted">{copy.summaryBody}</p>
      </div>
      <Link href="/account/store-credit" className={`${ACCOUNT_LINK} shrink-0`}>
        {copy.seeHistory}
        <CheckoutIcon name="arrow" className="size-3.5" />
      </Link>
    </section>
  )
}
