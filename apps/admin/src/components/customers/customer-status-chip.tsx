'use client'

import StatusChip from '@/components/layout/status-chip'
import { type CustomerActivity, customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'

type CustomerStatusChipProps = { activity: CustomerActivity }

const TONE = { vip: 'info', active: 'success', inactive: 'neutral' } as const

/** Figma Customers list (613:146276): VIP blue, recent buyer green, no recent orders grey. */
export default function CustomerStatusChip({ activity }: CustomerStatusChipProps) {
  // Hooks
  const copy = useCopy(customersContent)

  // Hovering says what it means (#38).
  return (
    <span title={copy.statusHints[activity]}>
      <StatusChip tone={TONE[activity]}>{copy.statuses[activity]}</StatusChip>
    </span>
  )
}
