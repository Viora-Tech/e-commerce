'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { DialogFooter, DialogHeader, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  EMPTY_TRACKING,
  type TrackingDraft,
  trackingPayload,
} from '@/components/orders/tracking-fields'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import CourierStep from './courier-step'
import DoneStep, { type BookedShipment } from './done-step'
import {
  type DraftOrder,
  MANUAL,
  type ParcelQuote,
  packageFor,
  parsePackage,
  quoteRequest,
  type ShipmentDraft,
  startingPick,
} from './flow-state'
import FlowSteps, { type FlowStep } from './flow-steps'
import PackageStep from './package-step'
import ReviewStep from './review-step'

type SingleShipmentFlowProps = {
  draft: ShipmentDraft
  order: DraftOrder
  onClose: () => void
  /** After booking, so the page behind shows the new status. */
  onBooked: () => void
}

const STEPS: readonly FlowStep[] = ['package', 'courier', 'review', 'done']

/** One order (one parcel at a time): Package → Courier → Review → Booked. */
export default function SingleShipmentFlow({
  draft,
  order,
  onClose,
  onBooked,
}: SingleShipmentFlowProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const [step, setStep] = useState<FlowStep>('package')
  const [parcelId, setParcelId] = useState(order.parcels[0]?.id ?? null)
  const [form, setForm] = useState(() =>
    order.parcels[0] ? packageFor(order, order.parcels[0], draft) : null,
  )
  const [quote, setQuote] = useState<ParcelQuote | null>(null)
  const [pick, setPick] = useState(MANUAL)
  const [tracking, setTracking] = useState<TrackingDraft>(EMPTY_TRACKING)
  const [busy, setBusy] = useState(false)
  const [booked, setBooked] = useState<BookedShipment | null>(null)

  // Helpers
  const askCouriers = async () => {
    if (!parcel || !form || !parsed || draft.couriers.length === 0) return
    setQuote(null)
    try {
      const [answer] = await api.shipments.quote({
        parcels: [quoteRequest(order, parcel, form, parsed)],
      })
      setQuote(answer ?? null)
      setPick(startingPick(answer?.options ?? []))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  // Event handlers
  const handleParcel = (id: string) => {
    const next = order.parcels.find((p) => p.id === id)
    if (!next) return
    setParcelId(next.id)
    setForm(packageFor(order, next, draft))
  }
  const handleNext = () => {
    if (step === 'package') {
      if (!parsed) {
        toast.error(copy.package.invalid)
        return
      }
      setStep('courier')
      setPick(MANUAL)
      void askCouriers()
      return
    }
    if (step === 'courier') {
      const typed = trackingPayload(tracking)
      if (pick === MANUAL && (!typed.trackingNumber || !typed.courier)) {
        toast.error(copy.courier.manualMissing)
        return
      }
      setStep('review')
    }
  }
  const handleBack = () => setStep(step === 'review' ? 'courier' : 'package')
  const handleBook = async () => {
    if (!parcel || !form || !parsed) return
    setBusy(true)
    try {
      if (pick === MANUAL) {
        const typed = trackingPayload(tracking)
        const r = await api.orders.fulfil({
          orderId: order.orderId,
          lines: parcel.lines.map((l) => ({ lineId: l.id, quantity: l.quantity })),
          ...typed,
        })
        setBooked({
          shipmentId: r.shipmentId,
          courier: typed.courier ?? '',
          waybill: typed.trackingNumber ?? '',
          labelUrl: null,
          trackingUrl: typed.trackingUrl ?? null,
          manual: true,
          canPickup: false,
        })
      } else {
        const s = await api.orders.createShipment({
          orderId: order.orderId,
          providerId: pick,
          fulfillmentOrderId: parcel.id ?? undefined,
          pickupLocationId: form.pickupLocationId,
          weightGrams: parsed.weightGrams,
          dimensionsCm: parsed.dimensionsCm,
          paymentMode: parsed.paymentMode,
          codAmountPaise: parsed.codAmountPaise,
        })
        setBooked({
          shipmentId: s.id,
          courier: chosen?.providerLabel ?? s.provider,
          waybill: s.waybill,
          labelUrl: s.labelUrl,
          trackingUrl: s.trackingUrl,
          manual: false,
          canPickup: draft.couriers.find((c) => c.id === pick)?.hasPickup ?? false,
        })
      }
      setStep('done')
      onBooked()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  const parcel = order.parcels.find((p) => p.id === parcelId) ?? order.parcels[0]
  if (order.blocked || !parcel) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{copy.title(order.orderNumber)}</DialogTitle>
        </DialogHeader>
        <p className="text-body text-muted-foreground">
          {copy.bulkPackage.blocked[order.blocked ?? 'nothing_to_ship']}
        </p>
        <DialogFooter>
          <Button onClick={onClose}>{copy.close}</Button>
        </DialogFooter>
      </>
    )
  }

  // Render logic
  const parsed = form ? parsePackage(form) : null
  const chosen = quote?.options.find((o) => o.providerId === pick) ?? null
  const place = draft.pickupPlaces.find((p) => p.id === (form?.pickupLocationId ?? null))
  const pickupLabel = place
    ? copy.package.place(place.name, place.city, place.pincode)
    : (parcel.locationName ?? '')
  const typed = trackingPayload(tracking)
  const canNext =
    step === 'package' ? parsed !== null : pick === MANUAL || (chosen !== null && !chosen.problem)

  return (
    <>
      <DialogHeader className="gap-3">
        <DialogTitle>{copy.title(order.orderNumber)}</DialogTitle>
        <FlowSteps steps={STEPS} current={step} labels={copy.steps} />
      </DialogHeader>
      <div className="-mx-4 min-h-0 overflow-y-auto px-4">
        {step === 'package' && form ? (
          <PackageStep
            draft={draft}
            order={order}
            parcel={parcel}
            form={form}
            onChange={setForm}
            onParcelChange={handleParcel}
          />
        ) : null}
        {step === 'courier' ? (
          <CourierStep
            quote={quote}
            hasCouriers={draft.couriers.length > 0}
            pick={pick}
            onPick={setPick}
            tracking={tracking}
            onTrackingChange={setTracking}
            onRetry={() => void askCouriers()}
          />
        ) : null}
        {step === 'review' && parsed ? (
          <ReviewStep
            order={order}
            parcel={parcel}
            pkg={parsed}
            pickupLabel={pickupLabel}
            courier={pick === MANUAL ? null : chosen}
            manual={
              pick === MANUAL
                ? { courier: typed.courier ?? '', awb: typed.trackingNumber ?? '' }
                : null
            }
          />
        ) : null}
        {step === 'done' && booked ? <DoneStep booked={booked} /> : null}
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
              <Button variant="outline" onClick={handleBack} disabled={busy}>
                {copy.back}
              </Button>
            )}
            {step === 'review' ? (
              <Button onClick={handleBook} disabled={busy}>
                {busy ? <Spinner /> : null}
                {busy
                  ? copy.review.booking
                  : pick === MANUAL
                    ? copy.review.saveManual
                    : copy.review.book}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canNext}>
                {copy.next}
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </>
  )
}
