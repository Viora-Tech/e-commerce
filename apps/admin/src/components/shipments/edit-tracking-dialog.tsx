'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { editTrackingContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type EditTrackingDialogProps = {
  /** The shipment to edit; null keeps the dialog closed. */
  shipment: {
    id: string
    waybill: string
    carrier: string | null
    trackingUrl: string | null
  } | null
  onClose: () => void
  onSaved: () => void
}

/**
 * "Edit tracking" on a shipment entered by hand: the tracking number, the courier and the
 * tracking link. Saving tells the customer the new details (Shipping update) when they had
 * the shipped message.
 */
export default function EditTrackingDialog({
  shipment,
  onClose,
  onSaved,
}: EditTrackingDialogProps) {
  // Hooks
  const copy = useCopy(editTrackingContent)
  const [waybill, setWaybill] = useState('')
  const [courier, setCourier] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [saving, setSaving] = useState(false)

  // Each opening starts from the shipment's saved details.
  useEffect(() => {
    if (!shipment) return
    setWaybill(shipment.waybill)
    setCourier(shipment.carrier ?? '')
    setTrackingUrl(shipment.trackingUrl ?? '')
  }, [shipment])

  // Event handlers
  const handleSave = async () => {
    if (!shipment) return
    setSaving(true)
    try {
      await api.shipments.updateTracking({
        shipmentId: shipment.id,
        waybill: waybill.trim(),
        courier: courier.trim(),
        trackingUrl: trackingUrl.trim(),
      })
      toast.success(copy.saved)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const canSave = !saving && waybill.trim().length > 0

  return (
    <Dialog open={shipment !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-tracking-waybill">{copy.waybill}</Label>
            <Input
              id="edit-tracking-waybill"
              value={waybill}
              maxLength={60}
              onChange={(e) => setWaybill(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-tracking-courier">{copy.courier}</Label>
            <Input
              id="edit-tracking-courier"
              value={courier}
              maxLength={80}
              placeholder={copy.courierPlaceholder}
              onChange={(e) => setCourier(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-tracking-url">{copy.trackingUrl}</Label>
            <Input
              id="edit-tracking-url"
              type="url"
              value={trackingUrl}
              maxLength={500}
              placeholder={copy.trackingUrlPlaceholder}
              onChange={(e) => setTrackingUrl(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? <Spinner /> : null}
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
