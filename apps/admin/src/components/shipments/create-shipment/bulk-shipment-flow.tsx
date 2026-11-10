'use client'

import type { CourierRateRow } from '@commerce/core'
import { RefreshCw, TriangleAlert, Truck } from '@commerce/ui/icons'
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
import BulkEditDialog, { type BulkEditOrder } from './bulk-edit-dialog'
import BulkPackageStep from './bulk-package-step'
import {
  type BulkMode,
  bulkOrders,
  bulkPicks,
  bulkQuoteRequests,
  bulkSplit,
  courierTotals,
  isBookable,
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
  /* The last ask failed: step 2 says so with a retry, never an empty table. */
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [mode, setMode] = useState<BulkMode>('cheapest')
  const [providerId, setProviderId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<BulkResult[] | null>(null)
  /** Couriers picked by hand in the Edit popup: orderId -> optionKey; beats the mode. */
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)

  // Helpers
  const askCouriers = async () => {
    setQuotes(null)
    setQuoteError(null)
    if (draft.couriers.length === 0) {
      setQuotes([])
      return
    }
    try {
      const answer = await api.shipments.quote({
        parcels: bulkQuoteRequests(ready, dims),
      })
      setQuotes(answer)
      const start = startingBulkPick(courierTotals(answer, draft.couriers), courier)
      if (start.mode) setMode(start.mode)
      setProviderId(start.providerId)
    } catch (err) {
      setQuoteError(err instanceof Error && err.message ? err.message : copy.courier.quoteFailed)
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
        .map((r) => ({
          orderId: r.orderId,
          ok: false,
          error: r.checkout
            ? copy.bulkCourier.routeFailed(`${r.checkout.carrier} ${r.checkout.serviceLabel}`)
            : copy.bulkCourier.noCourierFor,
        }))
      setResults([...booked, ...unbooked])
      setStep('done')
      onBooked()
      // Booking only books (owner, 10 Nov 2026): the pickup is made on Shipments › Booked.
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
  const byMode = quotes ? bulkPicks(quotes, mode, providerId) : {}
  const picked: Record<string, CourierRateRow | null> = { ...byMode }
  for (const q of quotes ?? []) {
    const key = overrides[q.orderId]
    const hand = key ? q.options.find((o) => o.optionKey === key && isBookable(o)) : undefined
    if (hand) picked[q.orderId] = hand
  }
  const editOrders: BulkEditOrder[] = (quotes ?? []).map((q) => ({
    orderId: q.orderId,
    orderNumber: numbers.get(q.orderId) ?? 0,
    options: q.options.filter(isBookable),
    pickedKey: picked[q.orderId]?.optionKey ?? null,
  }))
  const rows = (quotes ?? []).map((q) => ({
    orderId: q.orderId,
    orderNumber: numbers.get(q.orderId) ?? 0,
    row: picked[q.orderId] ?? null,
    checkout: q.checkout,
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
            {quoteError ? (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-lg border border-danger-border bg-danger-soft p-4"
              >
                <p className="flex items-start gap-2 text-body">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>
                    {copy.courier.quoteFailed}{' '}
                    <span className="text-muted-foreground">{quoteError}</span>
                  </span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  onClick={() => void askCouriers()}
                >
                  <RefreshCw aria-hidden="true" />
                  {copy.courier.retry}
                </Button>
              </div>
            ) : (
              <BulkCourierStep
                totals={quotes ? courierTotals(quotes, draft.couriers) : null}
                orderCount={ready.length}
                mode={mode}
                onModeChange={setMode}
                providerId={providerId}
                onProviderChange={setProviderId}
                picks={rows}
                onEdit={setEditing}
              />
            )}
          </div>
        ) : null}
        {step === 'done' && results ? (
          <BulkDoneStep results={results} numbers={numbers} pickupDate={null} />
        ) : null}
        <BulkEditDialog
          orders={editOrders}
          orderId={editing}
          onOrderChange={setEditing}
          onSave={(orderId, optionKey) => setOverrides((o) => ({ ...o, [orderId]: optionKey }))}
        />
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
                {busy ? <Spinner /> : <Truck aria-hidden="true" />}
                {busy ? copy.review.booking : copy.review.bookMany(bookable)}
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </>
  )
}
