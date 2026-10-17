'use client'

import StatusChip from '@/components/layout/status-chip'
import { orderStage } from '@/components/orders/order-stage'
import { toneFor } from '@/components/status/tone'
import { statusEntry } from '@/data/status'
import { useLocale } from '@/hooks/use-copy'
import { localizeStatusLabel } from '@/lib/status-labels'
import type { CustomerOrder } from './customer-detail-types'

type OrderStatusChipProps = { order: CustomerOrder }

/** An order's stage (to ship, fulfilled, cancelled) as a Proofly status chip. */
export default function OrderStatusChip({ order }: OrderStatusChipProps) {
  // Hooks
  const locale = useLocale()

  // Render logic
  const stage = orderStage(order)
  const entry = statusEntry(stage.kind, stage.value)

  return (
    <StatusChip tone={toneFor(entry.tone)}>{localizeStatusLabel(entry.label, locale)}</StatusChip>
  )
}
