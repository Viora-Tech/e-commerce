import { formatPaise } from '@commerce/blocks'
import { cartContent as content } from '@/data/cart'

type FreeShippingProgressProps = {
  /** Order value from which shipping is free everywhere. */
  thresholdPaise: number
  /** The cart after discounts: what the threshold is measured against. */
  totalPaise: number
}

/** "Add ₹X more for free shipping" with a bar, or the line saying it already ships free. */
export default function FreeShippingProgress({
  thresholdPaise,
  totalPaise,
}: FreeShippingProgressProps) {
  // Render logic
  const remaining = Math.max(0, thresholdPaise - totalPaise)
  const percent = thresholdPaise > 0 ? Math.min(100, (totalPaise / thresholdPaise) * 100) : 100

  return (
    <div className="free-shipping">
      <p className="free-shipping__text text-small">
        {remaining > 0
          ? content.freeShipping.remaining(formatPaise(remaining))
          : content.freeShipping.unlocked}
      </p>
      <progress
        className="free-shipping__bar"
        max={100}
        value={percent}
        aria-label={content.freeShipping.label}
      />
    </div>
  )
}
