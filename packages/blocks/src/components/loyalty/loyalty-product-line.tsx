import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { formatPaise } from '../../money'
import LoyaltyIcon from './loyalty-icon'
import type { LoyaltyPointsName } from './loyalty-types'

type LoyaltyProductLineProps = {
  /** Points this purchase earns (already more than 0). */
  points: number
  names: LoyaltyPointsName
  /** The member's balance; null for a visitor ("Collect points with our rewards program"). */
  balance: number | null
  /** What the points are worth, when the merchant shows it; null hides it. */
  worthPaise: number | null
}

/**
 * The product page's points line, Essential Loyalty's card: an award ribbon, then "Earn 2,199
 * points with this purchase" in bold (with "(worth ₹21)" when switched on) over a grey line, the
 * program for a visitor or the member's balance. White, a hairline border, gently rounded.
 */
export default function LoyaltyProductLine({
  points,
  names,
  balance,
  worthPaise,
}: LoyaltyProductLineProps) {
  // Render logic
  const amount = copy.points(points, names)
  return (
    <div
      data-kl-product-line
      className="flex items-center gap-3 rounded-[0.5rem] border border-(--kl-line) bg-(--kl-surface) px-3.5 py-2.5 text-left font-sans normal-case tracking-normal text-(--kl-ink)"
    >
      <LoyaltyIcon name="award" className="size-8 shrink-0 text-(--kl-ink)" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[0.875rem] font-semibold leading-snug">
          {copy.product.earn(amount)}
          {worthPaise ? (
            <span className="font-normal text-(--kl-muted)">
              {' '}
              {copy.product.worth(formatPaise(worthPaise))}
            </span>
          ) : null}
        </span>
        <span className="text-[0.8125rem] leading-snug text-(--kl-muted)">
          {balance === null
            ? copy.product.guestSub
            : copy.product.memberSub(copy.points(balance, names), amount)}
        </span>
      </span>
    </div>
  )
}
