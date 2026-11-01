'use client'

import type { FulfillmentHoldReason } from '@commerce/core/order-edit-rules'
import { Pause } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { orderHoldContent } from '@/data/order-hold'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { OrderDetail } from './order-detail-types'

type OrderHoldBannerProps = {
  orderId: string
  hold: NonNullable<OrderDetail['hold']>
  /** Absent when the member cannot fulfil orders: the banner then only explains. */
  canRelease: boolean
  onChanged: () => void
}

/** A held order's strip (#1011): why, who and since when, and "Release hold". */
export default function OrderHoldBanner({
  orderId,
  hold,
  canRelease,
  onChanged,
}: OrderHoldBannerProps) {
  // Hooks
  const copy = useCopy(orderHoldContent)
  const fmt = useFormat()
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleRelease = async () => {
    setBusy(true)
    try {
      await api.orders.releaseFulfillment({ orderId })
      toast.success(copy.released)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const picked = hold.code ? copy.reasons[hold.code as FulfillmentHoldReason] : undefined
  const why = [picked, hold.note].filter(Boolean).join(': ') || copy.banner.noReason
  const since = hold.heldAt ? fmt.ago(hold.heldAt) : null
  const who = since
    ? hold.heldBy
      ? copy.banner.by(hold.heldBy, since)
      : copy.banner.since(since)
    : null

  return (
    <Alert className="print:hidden">
      <Pause aria-hidden="true" />
      <AlertTitle>{copy.banner.title}</AlertTitle>
      <AlertDescription>
        <p className="text-foreground">{why}</p>
        {who ? <p>{who}</p> : null}
        {canRelease ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            loading={busy}
            onClick={handleRelease}
          >
            {copy.banner.release}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
