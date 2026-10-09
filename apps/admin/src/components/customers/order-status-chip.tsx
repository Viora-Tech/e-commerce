'use client'

import StatusChip from '@/components/layout/status-chip'
import { orderStage } from '@/components/orders/order-stage'
import { type StatusTone, statusEntry } from '@/data/status'
import { useLocale } from '@/hooks/use-copy'
import { localizeStatusLabel } from '@/lib/status-labels'
import type { CustomerOrder } from './customer-detail-types'

type OrderStatusChipProps = { order: CustomerOrder }

/** Coloured only where the merchant has something to do: waiting, failed or in progress. */
const TONE: Record<StatusTone, 'neutral' | 'attention' | 'info' | 'danger'> = {
  success: 'neutral',
  pending: 'attention',
  error: 'danger',
  info: 'info',
  accent: 'neutral',
  neutral: 'neutral',
}

/** An order's stage (to ship, fulfilled, cancelled) as a Proofly status chip. */
export default function OrderStatusChip({ order }: OrderStatusChipProps) {
  // Hooks
  const locale = useLocale()

  // Render logic
  const stage = orderStage(order)
  const entry = statusEntry(stage.kind, stage.value)

  return <StatusChip tone={TONE[entry.tone]}>{localizeStatusLabel(entry.label, locale)}</StatusChip>
}
