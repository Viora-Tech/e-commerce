'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { DialogFooter, DialogHeader, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import BulkCourierStep from './bulk-courier-step'
import BulkDoneStep from './bulk-done-step'
import BulkPackageStep from './bulk-package-step'
import {
  type BulkMode,
  bulkOrders,
  bulkPicks,
  bulkSplit,
  courierTotals,
  OWN_WEIGHT,
  type ParcelQuote,
  type ShipmentDraft,
  startingBulkPick,
} from './flow-state'
import FlowSteps, { type FlowStep } from './flow-steps'

type BulkShipmentFlowProps = {
  draft: ShipmentDraft
  /** Start on "one courier for all" with this courier (a courier app's Create shipment). */
  courier?: string | undefined
  onClose: () => void
  onBooked: () => void
}

type BulkResult = Awaited<ReturnType<typeof api.shipments.bulkBook>>[number]

const STEPS: readonly FlowStep[] = ['package', 'courier', 'done']

/** Several orders at once: the box for all → one courier, or the cheapest or fastest for each
 *  → booked, order by order. */
export default function BulkShipmentFlow({
  draft,
  courier,
  onClose,
  onBooked,
}: BulkShipmentFlowProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const [step, setStep] = useState<FlowStep>('package')
  const [boxId, setBoxId] = useState(OWN_WEIGHT)
  const [quotes, setQuotes] = useState<ParcelQuote[] | null>(null)
  const [mode, setMode] = useState<BulkMode>('cheapest')
  const [providerId, setProviderId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<BulkResult[] | null>(null)

  // Helpers
  const askCouriers = async () => {
    setQuotes(null)
    if (draft.couriers.length === 0) {
      setQuotes([])
      return
    }
    try {
      const answer = await api.shipments.quote({
        parcels: ready.map(({ order, parcel }) => ({
          orderId: order.orderId,
          fulfillmentOrderId: parcel.id,
          pickupLocationId: parcel.pickupLocationId,
          weightGrams: parcel.weightGrams,
          dimensionsCm: dims ?? parcel.dimensionsCm ?? undefined,
          paymentMode: order.paymentMode,
          declaredValuePaise: parcel.valuePaise,
        })),
      })
      setQuotes(answer)
      const start = startingBulkPick(courierTotals(answer, draft.couriers), courier)
      if (start.mode) setMode(start.mode)
      setProviderId(start.providerId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setQuotes([])
    }
  }

  // Event handlers
  const handleNext = () => {
    setStep('courier')
    void askCouriers()
  }
  const handleBook = async () => {
    const { orderIds, courierOverrides, serviceOverrides } = bulkOrders(picked)
    if (orderIds.length === 0) return
    setBusy(true)
    try {
      const booked = await api.shipments.bulkBook({
        orderIds,
        courierOverrides,
        ...(Object.keys(serviceOverrides).length ? { serviceOverrides } : {}),
        dimensionsCm: dims,
      })
      const unbooked = rows
        .filter((r) => !r.row)
        .map((r) => ({ orderId: r.orderId, ok: false, error: copy.bulkCourier.noCourierFor }))
      setResults([...booked, ...unbooked])
      setStep('done')
      onBooked()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const { ready, skipped } = bulkSplit(draft.orders)
  const box = draft.boxes.find((b) => b.id === boxId)
  const dims = box ? { length: box.lengthCm, width: box.widthCm, height: box.heightCm } : undefined
  const numbers = new Map(draft.orders.map((o) => [o.orderId, o.orderNumber]))
  const picked = quotes ? bulkPicks(quotes, mode, providerId) : {}
  const rows = (quotes ?? []).map((q) => ({
    orderId: q.orderId,
    orderNumber: numbers.get(q.orderId) ?? 0,
    row: picked[q.orderId] ?? null,
  }))
  const bookable = rows.filter((r) => r.row).length

  return (
    <>
      <DialogHeader className="gap-3">
        <DialogTitle>{copy.bulkTitle(ready.length)}</DialogTitle>
        <FlowSteps steps={STEPS} current={step} labels={copy.steps} />
      </DialogHeader>
      <div className="-mx-4 min-h-0 overflow-y-auto px-4">
        {step === 'package' ? (
          <BulkPackageStep
            ready={ready}
            skipped={skipped}
            boxes={draft.boxes}
            boxId={boxId}
            onBoxChange={setBoxId}
          />
        ) : null}
        {step === 'courier' ? (
          <div className="flex flex-col gap-3">
            {draft.couriers.length === 0 ? (
              <p className="text-body text-muted-foreground">{copy.courier.noCourier}</p>
            ) : null}
            <BulkCourierStep
              totals={quotes ? courierTotals(quotes, draft.couriers) : null}
              orderCount={ready.length}
              mode={mode}
              onModeChange={setMode}
              providerId={providerId}
              onProviderChange={setProviderId}
              picks={rows}
            />
          </div>
        ) : null}
        {step === 'done' && results ? <BulkDoneStep results={results} numbers={numbers} /> : null}
      </div>
      <DialogFooter>
        {step === 'done' ? (
          <Button onClick={onClose}>{copy.close}</Button>
        ) : (
          <>
            {step === 'package' ? (
              <Button variant="outline" onClick={onClose}>
                {copy.cancel}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStep('package')} disabled={busy}>
                {copy.back}
              </Button>
            )}
            {step === 'package' ? (
              <Button onClick={handleNext} disabled={ready.length === 0}>
                {copy.next}
              </Button>
            ) : (
              <Button onClick={handleBook} disabled={busy || bookable === 0}>
                {busy ? <Spinner /> : null}
                {busy ? copy.review.booking : copy.review.bookMany(bookable)}
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </>
  )
}
