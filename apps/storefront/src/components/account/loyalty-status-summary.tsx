import { formatPaise } from '@commerce/blocks'
import Link from 'next/link'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { loyaltyAccountContent } from '@/data/loyalty'
import { ACCOUNT_CARD, ACCOUNT_LINK } from '@/lib/account-classes'

type LoyaltyStatusSummaryProps = {
  points: number
  /** Rewards the member can claim now. */
  ready: number
  /** What the points are worth (each point's value), 0 to leave it out. */
  worthPaise: number
}

const copy = loyaltyAccountContent.status

/**
 * Essential Loyalty's "Loyalty status" in the customer account: the member's points (and what
 * they are worth, and rewards ready to claim) at the top of the Orders page, with a link to the
 * Points section.
 */
export default function LoyaltyStatusSummary({
  points,
  ready,
  worthPaise,
}: LoyaltyStatusSummaryProps) {
  // Render logic
  const line = [worthPaise > 0 ? copy.worth(formatPaise(worthPaise)) : '', copy.rewards(ready)]
    .filter(Boolean)
    .join(' · ')
  return (
    <section
      className={`${ACCOUNT_CARD} mb-4! flex-row! items-center gap-3! sm:mb-5!`}
      aria-labelledby="loyalty-status"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ck-accent-soft text-ck-accent">
        <CheckoutIcon name="gift" className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p id="loyalty-status" className="text-[0.8125rem] font-medium text-ck-muted">
          {copy.title}
        </p>
        <p className="text-[1.25rem] font-bold leading-tight tabular-nums text-ck-ink">
          {loyaltyAccountContent.points(points)}
        </p>
        {line ? <p className="text-[0.8125rem] text-ck-muted">{line}</p> : null}
      </div>
      <Link href="/account/points" className={`${ACCOUNT_LINK} shrink-0`}>
        {copy.open}
        <CheckoutIcon name="arrow" className="size-3.5" />
      </Link>
    </section>
  )
}
