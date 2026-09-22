import StatusPill, { type StatusTone } from '@/components/layout/status-pill'
import { type DiscountLifecycle, discountsContent } from '@/data/discounts'

const TONE: Record<DiscountLifecycle, StatusTone> = {
  active: 'success',
  scheduled: 'info',
  expired: 'neutral',
  disabled: 'destructive',
}

/** Dot + label for where a discount is in its life. */
export default function DiscountLifecyclePill({ lifecycle }: { lifecycle: DiscountLifecycle }) {
  return <StatusPill tone={TONE[lifecycle]}>{discountsContent.lifecycle[lifecycle]}</StatusPill>
}
