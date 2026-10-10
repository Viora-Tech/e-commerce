'use client'

import StatusChip from '@/components/layout/status-chip'
import { type CustomerActivity, customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'

type CustomerStatusChipProps = { activity: CustomerActivity }

/** VIP is the one blue chip (worth a thank-you); active and inactive are quiet grey. */
export default function CustomerStatusChip({ activity }: CustomerStatusChipProps) {
  // Hooks
  const copy = useCopy(customersContent).statuses

  return <StatusChip tone={activity === 'vip' ? 'info' : 'neutral'}>{copy[activity]}</StatusChip>
}
