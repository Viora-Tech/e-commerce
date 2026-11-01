'use client'

import StatusChip from '@/components/layout/status-chip'
import { paymentProvidersContent } from '@/data/payment-providers'
import { useCopy } from '@/hooks/use-copy'
import { PROVIDER_TONE, type ProviderStatus } from './provider-status'

type ProviderStatusChipProps = {
  status: ProviderStatus
}

/** "Active", "Inactive", "Test mode" or "Needs attention" beside a payment provider's name. */
export default function ProviderStatusChip({ status }: ProviderStatusChipProps) {
  // Hooks
  const { status: copy } = useCopy(paymentProvidersContent)

  return <StatusChip tone={PROVIDER_TONE[status]}>{copy[status]}</StatusChip>
}
