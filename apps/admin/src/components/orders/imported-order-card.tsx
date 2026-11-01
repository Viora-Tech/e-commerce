'use client'

import { canTakeOver } from '@commerce/core/order-edit-rules'
import { ArrowRight } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import KeyValueList, { type KeyValueRow } from '@/components/layout/key-value-list'
import { orderDetailContent } from '@/data/order-detail'
import { orderTakeoverContent } from '@/data/order-edit'
import { importedOrderContent } from '@/data/orders'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { importedGatewayLabel, type OrderDetail } from './order-detail-types'

type ImportedOrderCardProps = {
  order: OrderDetail
  /** The member may take the order over (orders.write). */
  canTakeOver: boolean
  onChanged: () => void
}

/** "shopify" → "Shopify". */
const platformName = (source: string) => `${source[0]?.toUpperCase() ?? ''}${source.slice(1)}`

/**
 * Says an order came from another platform. History stays a read-only record; an order that is
 * still open offers "Manage this order" (take it over), after which the card says it was taken over.
 */
export default function ImportedOrderCard({
  order,
  canTakeOver: allowed,
  onChanged,
}: ImportedOrderCardProps) {
  // Hooks
  const copy = useCopy(importedOrderContent)
  const takeover = useCopy(orderTakeoverContent)
  const detail = useCopy(orderDetailContent)
  const fmt = useFormat()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleTakeOver = async () => {
    setBusy(true)
    try {
      await api.orders.takeOver({ orderId: order.id })
      toast.success(takeover.done)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : takeover.failed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  const meta = order.importMeta
  const taken = meta?.takenOver ?? null
  if (!order.importedFrom && !taken) return null

  // Render logic
  const source = order.importedFrom ?? taken?.source ?? ''
  const open = allowed && canTakeOver(order)
  const rows: KeyValueRow[] = [
    { label: copy.name, value: meta?.name ?? `#${order.number}` },
    { label: copy.financial, value: copy.status(meta?.financialStatus) },
    { label: copy.fulfillment, value: copy.status(meta?.fulfillmentStatus) },
    {
      label: copy.payment,
      value: meta?.paymentMethod ? importedGatewayLabel(meta.paymentMethod, detail) : null,
      hidden: !meta?.paymentMethod,
    },
    {
      label: copy.cancelled,
      value: meta?.cancelledAt ? fmt.dateTime(meta.cancelledAt) : null,
      hidden: !meta?.cancelledAt,
    },
  ]

  return (
    <DataCard
      title={taken ? takeover.managed(platformName(source)) : copy.title(source)}
      footer={
        open ? (
          <Button onClick={() => setConfirming(true)} disabled={busy}>
            {takeover.action}
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : undefined
      }
    >
      <p className="text-body text-muted-foreground">
        {taken ? takeover.managedBody : open ? takeover.hint : copy.body}
      </p>
      {taken ? (
        <p className="mt-1 text-caption text-muted-foreground">
          {takeover.managedBy(taken.by, fmt.dateTime(taken.at))}
        </p>
      ) : null}
      <KeyValueList rows={rows} variant="grid" className="mt-4" />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={takeover.dialogTitle}
        body={takeover.dialogBody}
        confirmLabel={takeover.confirm}
        cancelLabel={takeover.cancel}
        tone="default"
        onConfirm={handleTakeOver}
      />
    </DataCard>
  )
}
