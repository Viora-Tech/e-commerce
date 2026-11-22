'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { inboundShipmentFormContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type Outstanding = Awaited<ReturnType<typeof api.inboundShipments.outstanding>>

type MarkDeliveredDialogProps = {
  /** The shipment to mark delivered; the dialog is open while this is set. */
  shipmentId: string | null
  onClose: () => void
  onDone: () => void
}

/**
 * "Mark as delivered" (#1065), from the shipment page or the list's row menu: shows what is
 * still to come in on the shipment's purchase orders, then receives all of it into stock and
 * marks the shipment delivered.
 */
export default function MarkDeliveredDialog({
  shipmentId,
  onClose,
  onDone,
}: MarkDeliveredDialogProps) {
  // Hooks
  const { deliver: copy } = useCopy(inboundShipmentFormContent)
  const { data, loading } = useLoad(
    async () =>
      shipmentId
        ? api.inboundShipments
            .outstanding({ id: shipmentId })
            .catch(() => ({ orders: [], units: 0 }))
        : null,
    [shipmentId],
  )
  const outstanding: Outstanding | null = loading ? null : data
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleConfirm = async () => {
    if (!shipmentId) return
    setBusy(true)
    try {
      const { units } = await api.inboundShipments.receive({ id: shipmentId })
      toast.success(copy.done(units))
      onClose()
      onDone()
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const body = !outstanding
    ? copy.loading
    : outstanding.units > 0
      ? copy.body(outstanding.units, outstanding.orders.length)
      : copy.nothing

  return (
    <ConfirmDialog
      open={shipmentId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={copy.title}
      body={body}
      confirmLabel={copy.confirm}
      cancelLabel={copy.cancel}
      tone="default"
      busy={busy}
      confirmDisabled={!outstanding}
      stopPropagation
      onConfirm={handleConfirm}
    >
      {outstanding && outstanding.units > 0 ? (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1 text-body">
            {outstanding.orders.map((o) => (
              <li key={o.id}>{copy.order(o.number, o.units)}</li>
            ))}
          </ul>
          <p className="text-caption text-muted-foreground">{copy.shortHint}</p>
        </div>
      ) : null}
    </ConfirmDialog>
  )
}
