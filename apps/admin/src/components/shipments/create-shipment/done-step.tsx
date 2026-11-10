'use client'

import { CircleCheck, Download, ExternalLink, Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import CopyButton from '@/components/fields/copy-button'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'

export type BookedShipment = {
  shipmentId: string | null
  courier: string
  waybill: string
  labelUrl: string | null
  trackingUrl: string | null
  /** Shipped by the merchant themselves: no label, no pickup to ask for. */
  manual: boolean
  /** The courier takes pickup requests from here. */
  canPickup: boolean
  /** The pickup was already asked for at booking, so there is nothing left to schedule. */
  pickupRequested?: boolean
}

type DoneStepProps = {
  booked: BookedShipment
  /** Only the "booked" note: the page shows the shipment's details beside it. */
  summaryOnly?: boolean
}

/** Step 4: the AWB, the label to print or download, and the pickup request. */
export default function DoneStep({ booked, summaryOnly = false }: DoneStepProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.done)
  const pickupCopy = useCopy(createShipmentContent.pickup)

  // Render logic
  const label = booked.labelUrl

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success-soft p-3">
        <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="flex flex-col gap-0.5">
          <p className="font-medium text-ink-strong">
            {booked.manual ? copy.manualHeading : copy.heading}
          </p>
          <p className="text-body text-muted-foreground">
            {booked.manual ? copy.manualBody : copy.body(booked.courier)}
          </p>
        </div>
      </div>

      {summaryOnly ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline p-3">
            <span className="flex items-center gap-1.5 text-body">
              <span className="text-muted-foreground">{copy.awb}</span>
              <code className="text-ink-strong">{booked.waybill}</code>
              <CopyButton value={booked.waybill} what={copy.awb} visible />
            </span>
            <span className="flex flex-wrap gap-2">
              {label ? (
                <>
                  <Button
                    render={<a href={label} target="_blank" rel="noreferrer" />}
                    nativeButton={false}
                  >
                    <Printer aria-hidden />
                    {copy.printLabel}
                  </Button>
                  <Button
                    variant="outline"
                    render={<a href={label} download target="_blank" rel="noreferrer" />}
                    nativeButton={false}
                  >
                    <Download aria-hidden />
                    {copy.downloadLabel}
                  </Button>
                </>
              ) : null}
              {booked.trackingUrl ? (
                <Button
                  variant="outline"
                  render={<a href={booked.trackingUrl} target="_blank" rel="noreferrer" />}
                  nativeButton={false}
                >
                  <ExternalLink aria-hidden />
                  {copy.track}
                </Button>
              ) : null}
            </span>
          </div>
          {!label && !booked.manual ? (
            <p className="text-caption text-muted-foreground">{copy.noLabel}</p>
          ) : null}

          {booked.pickupRequested ? (
            <p className="text-body text-muted-foreground">{pickupCopy.scheduled}</p>
          ) : null}
          {booked.canPickup && booked.shipmentId && !booked.pickupRequested ? (
            <p className="text-body text-muted-foreground">{pickupCopy.fromBooked}</p>
          ) : null}
        </>
      )}
    </div>
  )
}
