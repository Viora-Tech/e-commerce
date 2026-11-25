import type { LoyaltyRewardType } from '@commerce/core/loyalty'
import {
  BadgePercent,
  CreditCard,
  Gift,
  ReceiptIcon,
  SlidersHorizontal,
  Truck,
} from '@commerce/ui/icons'
import type { ComponentType } from 'react'

type RewardIconProps = { type: LoyaltyRewardType }

const BY_TYPE: Record<LoyaltyRewardType, ComponentType<{ className?: string }>> = {
  amount_off: ReceiptIcon,
  custom_amount_off: SlidersHorizontal,
  percent_off: BadgePercent,
  free_product: Gift,
  free_shipping: Truck,
  store_credit: CreditCard,
}

/** The glyph for a reward type, in the same small tile as the earning rules. */
export default function RewardIcon({ type }: RewardIconProps) {
  // Render logic
  const Glyph = BY_TYPE[type]

  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-strong">
      <Glyph className="size-4" />
    </span>
  )
}
