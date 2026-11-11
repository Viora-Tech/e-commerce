'use client'

import {
  COURIERS,
  type CourierId,
  courierById,
  trackingUrlFor,
} from '@commerce/core/tracking-numbers'
import { PackageCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { approvalsContent } from '@/data/approvals'
import { dialogContent } from '@/data/common'
import { ordersContent } from '@/data/orders'
import { ordersBulkContent } from '@/data/orders-bulk'
import { useCopy } from '@/hooks/use-copy'
import { api, isApprovalQueued } from '@/lib/api-client'
import { bulkFulfilPlan } from '@/lib/order-next-move'
import { runBatched } from '@/lib/run-batched'

type BulkFulfilDialogProps = {
  /** The selected orders; null keeps the dialog closed. */
  ids: string[] | null
  /** The rows on screen: their numbers label the tracking fields, and done ones are skipped. */
  items: readonly {
    id: string
    number: number
    status: string
    fulfillmentStatus: string | null
    importedFrom: string | null
  }[]
  onClose: () => void
  /** After the run: clear the selection and read the rows again. */
  onDone: () => void
}

/** The API refused this order for a reason that is a skip (nothing left, held, cancelled). */
const isSkip = (err: unknown) => (err as { code?: unknown } | null)?.code === 'BAD_REQUEST'

/**
 * Bulk "Mark as fulfilled" on the orders list (owner, 11 Nov 2026): one courier for every
 * selected order, an optional tracking number per order on screen, and Notify customers. Each
 * order packs everything left (`orders.fulfilAll`, the pack form's checks).
 */
export default function BulkFulfilDialog({ ids, items, onClose, onDone }: BulkFulfilDialogProps) {
  // Hooks
  const copy = useCopy(ordersBulkContent)
  const list = useCopy(ordersContent)
  const approvals = useCopy(approvalsContent)
  const shared = useCopy(dialogContent)
  const [courierId, setCourierId] = useState<CourierId>('other')
  const [otherName, setOtherName] = useState('')
  const [tracking, setTracking] = useState<Record<string, string>>({})
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!ids) return
    setCourierId('other')
    setOtherName('')
    setTracking({})
    setNotify(true)
  }, [ids])

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!courier) return
    setBusy(true)
    let packed = 0
    let skipped = plan.skipped
    let queued = 0
    try {
      const { failed } = await runBatched(plan.due, async (orderId) => {
        const trackingNumber = tracking[orderId]?.trim()
        const trackingUrl = trackingNumber ? trackingUrlFor(courierId, trackingNumber) : null
        try {
          await api.orders.fulfilAll({
            orderId,
            courier,
            notifyCustomer: notify,
            ...(trackingNumber ? { trackingNumber } : {}),
            ...(trackingUrl ? { trackingUrl } : {}),
          })
          packed += 1
        } catch (err) {
          if (isApprovalQueued(err)) queued += 1
          else if (isSkip(err)) skipped += 1
          else throw err
        }
      })
      if (failed > 0) toast.warning(list.bulk.partlyFailed(packed, failed))
      else if (packed > 0 || skipped > 0) toast.success(copy.fulfilDone(packed, skipped))
      if (queued > 0) toast.info(approvals.sent)
      onDone()
    } catch {
      toast.error(list.bulk.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const plan = bulkFulfilPlan(ids ?? [], items)
  const byId = new Map(items.map((o) => [o.id, o]))
  const shown = plan.due.filter((id) => byId.has(id))
  const offScreen = plan.due.length - shown.length
  const courier = courierId === 'other' ? otherName.trim() : (courierById(courierId)?.name ?? '')
  const courierItems = COURIERS.map((c) => ({ value: c.id, label: c.name }))

  return (
    <Dialog open={ids !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>{copy.fulfilTitle(plan.due.length)}</DialogTitle>
            <DialogDescription>
              {plan.skipped > 0
                ? `${copy.fulfilBody} ${copy.fulfilSkipping(plan.skipped)}`
                : copy.fulfilBody}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="bulk-fulfil-courier">{copy.fulfilCourier}</FieldLabel>
            <Select
              items={courierItems}
              value={courierId}
              onValueChange={(v) => v && setCourierId(v as CourierId)}
            >
              <SelectTrigger id="bulk-fulfil-courier" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {courierItems.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {courierId === 'other' ? (
            <Field>
              <FieldLabel htmlFor="bulk-fulfil-other">{copy.fulfilCourierName}</FieldLabel>
              <Input
                id="bulk-fulfil-other"
                maxLength={60}
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder={copy.fulfilCourierNamePlaceholder}
              />
            </Field>
          ) : null}
          {shown.length > 0 ? (
            <Field>
              <FieldLabel>{copy.fulfilTracking}</FieldLabel>
              <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {shown.map((id) => (
                  <li key={id} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-body tabular-nums">
                      #{byId.get(id)?.number}
                    </span>
                    <Input
                      aria-label={`${copy.fulfilTrackingPlaceholder} #${byId.get(id)?.number}`}
                      maxLength={60}
                      value={tracking[id] ?? ''}
                      onChange={(e) => setTracking((t) => ({ ...t, [id]: e.target.value }))}
                      placeholder={copy.fulfilTrackingPlaceholder}
                    />
                  </li>
                ))}
              </ul>
              {offScreen > 0 ? (
                <FieldDescription>{copy.fulfilNotListed(offScreen)}</FieldDescription>
              ) : null}
            </Field>
          ) : null}
          <Label htmlFor="bulk-fulfil-notify" className="flex items-center gap-2 font-normal">
            <Checkbox
              id="bulk-fulfil-notify"
              checked={notify}
              onCheckedChange={(v) => setNotify(v === true)}
            />
            {copy.fulfilNotify}
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {shared.cancel}
            </Button>
            <Button type="submit" disabled={busy || !courier || plan.due.length === 0}>
              <PackageCheck aria-hidden="true" />
              {copy.fulfilConfirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
