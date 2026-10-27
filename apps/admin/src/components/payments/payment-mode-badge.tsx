'use client'

import StatusChip from '@/components/layout/status-chip'
import { type PaymentModeId, paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'

type PaymentModeBadgeProps = {
  mode: PaymentModeId | null
}

/** A gateway's mode at a glance: green "Live" or amber "Test mode". Nothing before keys are saved. */
export default function PaymentModeBadge({ mode }: PaymentModeBadgeProps) {
  // Hooks
  const { mode: copy } = useCopy(paymentModesContent)

  // Early returns
  if (!mode) return null

  return (
    <StatusChip tone={mode === 'live' ? 'success' : 'attention'}>{copy.badge[mode]}</StatusChip>
  )
}
