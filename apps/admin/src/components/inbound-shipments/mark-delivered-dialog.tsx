'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { inboundShipmentFormContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

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
  const [outstanding, setOutstanding] = useState<Outstanding | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setOutstanding(null)
    if (!shipmentId) return
    let cancelled = false
    api.inboundShipments
      .outstanding({ id: shipmentId })
      .catch(() => ({ orders: [], units: 0 }))
      .then((found) => {
        if (!cancelled) setOutstanding(found)
      })
    return () => {
      cancelled = true
    }
  }, [shipmentId])

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
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
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
