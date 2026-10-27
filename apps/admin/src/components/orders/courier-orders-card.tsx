'use client'

import { RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { OrderDetail } from './order-detail-types'

type CourierOrdersCardProps = {
  orderId: string
  rows: OrderDetail['courierOrders']
  canRetry: boolean
  onChanged: () => void
}

const NAMES: Record<string, string> = { shiprocket: 'Shiprocket', rapidshyp: 'RapidShyp' }

const TONE = {
  pushed: 'info',
  booked: 'success',
  cancelled: 'neutral',
  failed: 'danger',
} as const

/**
 * Where the order was sent as a pending order (Shiprocket, RapidShyp): waiting there, booked,
 * taken back after a cancel, or refused with the courier's reason and a Retry.
 */
export default function CourierOrdersCard({
  orderId,
  rows,
  canRetry,
  onChanged,
}: CourierOrdersCardProps) {
  // Hooks
  const { courierOrders: copy } = useCopy(orderDetailContent)
  const [retrying, setRetrying] = useState<string | null>(null)

  // Event handlers
  const handleRetry = async (provider: string) => {
    setRetrying(provider)
    try {
      const r = await api.orders.retryCourierPush({ orderId, provider })
      if (r.sent) toast.success(copy.sent(NAMES[provider] ?? provider))
      else toast.error(copy.refused)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.refused)
    } finally {
      setRetrying(null)
    }
  }

  // Early returns
  if (rows.length === 0) return null

  // Render logic
  return (
    <DataCard title={copy.heading}>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.provider} className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between gap-3">
              <span className="text-body text-ink-strong">{NAMES[r.provider] ?? r.provider}</span>
              <StatusChip tone={TONE[r.status]}>{copy.status[r.status]}</StatusChip>
            </span>
            {r.error ? <span className="text-caption text-muted-foreground">{r.error}</span> : null}
            {r.status === 'failed' && canRetry ? (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                disabled={retrying !== null}
                onClick={() => handleRetry(r.provider)}
              >
                <RefreshCw aria-hidden="true" />
                {retrying === r.provider ? copy.retrying : copy.retry}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </DataCard>
  )
}
