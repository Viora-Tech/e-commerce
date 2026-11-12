'use client'

import { CircleCheck, ExternalLink, Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ReactNode } from 'react'
import CopyButton from '@/components/fields/copy-button'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { todayKey } from '@/lib/format-date'

/** What the booking cost and when it lands, for the Booked drawer's Shipment box (Figma 905:7783). */
export type BookedFacts = {
  orderNumber: number
  customerName: string | null
  /** "YYYY-MM-DD", the courier's latest expected delivery day. */
  deliveryBy: string | null
  /** What the booking cost, incl. GST (and insurance when `insured`). */
  chargedPaise: number | null
  insured: boolean
  /** The courier wallet's name and what is left in it, once read again after the booking. */
  walletLabel: string | null
  walletLeftPaise: number | null
}

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
  facts?: BookedFacts | undefined
}

type DoneStepProps = {
  booked: BookedShipment
  /** Only the "booked" note: the page shows the shipment's details beside it. */
  summaryOnly?: boolean
  /** Create pickup now (the Booked drawer); without it the step says where pickups are made. */
  onCreatePickup?: (() => void) | undefined
  /** Back to orders (the Booked drawer). */
  backHref?: string | undefined
}

/** Days from today to `day`, both "YYYY-MM-DD". */
const daysUntil = (day: string) =>
  Math.round((Date.parse(day) - Date.parse(todayKey())) / (24 * 60 * 60 * 1000))

/**
 * After booking (Figma 905:7783): the Shipment box (AWB to copy, order, delivery by, what was
 * charged, the wallet left) beside the Next box with its two steps, print the label and create
 * the pickup, and their buttons.
 */
export default function DoneStep({
  booked,
  summaryOnly = false,
  onCreatePickup,
  backHref,
}: DoneStepProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.done)
  const bookedCopy = useCopy(createShipmentContent.booked)
  const pickupCopy = useCopy(createShipmentContent.pickup)
  const fmt = useFormat()

  // Early returns
  if (summaryOnly) {
    return (
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
    )
  }

  // Render logic
  const label = booked.labelUrl
  const facts = booked.facts
  const canAskPickup = booked.canPickup && booked.shipmentId !== null && !booked.pickupRequested
  const pickupHelp = booked.pickupRequested
    ? pickupCopy.scheduled
    : canAskPickup
      ? bookedCopy.pickupStepHelp
      : pickupCopy.unavailable

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-xl border border-hairline p-5">
        <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
          {bookedCopy.shipment}
        </p>
        <dl className="flex flex-col gap-3 text-body">
          <Fact label={bookedCopy.awb} note={booked.courier}>
            <span className="flex items-center gap-1">
              <code className="break-all text-ink-strong">{booked.waybill}</code>
              <CopyButton value={booked.waybill} what={bookedCopy.awb} visible />
            </span>
          </Fact>
          {facts ? (
            <Fact label={bookedCopy.order} note={facts.customerName}>
              #{facts.orderNumber}
            </Fact>
          ) : null}
          {facts?.deliveryBy ? (
            <Fact
              label={bookedCopy.deliveryBy}
              note={bookedCopy.inDays(daysUntil(facts.deliveryBy))}
            >
              {fmt.pattern(facts.deliveryBy, { weekday: 'short', day: 'numeric', month: 'short' })}
            </Fact>
          ) : null}
          {facts?.chargedPaise != null ? (
            <Fact
              label={bookedCopy.charged}
              note={facts.insured ? bookedCopy.inclGstInsurance : bookedCopy.inclGst}
            >
              {fmt.money(facts.chargedPaise)}
            </Fact>
          ) : null}
          {facts?.walletLeftPaise != null ? (
            <Fact label={bookedCopy.wallet} note={facts.walletLabel}>
              {bookedCopy.walletLeft(fmt.money(facts.walletLeftPaise))}
            </Fact>
          ) : null}
        </dl>
      </section>

      <section className="flex flex-col justify-between gap-5 rounded-xl border border-hairline p-5">
        <div className="flex flex-col gap-3">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            {bookedCopy.next}
          </p>
          {booked.manual ? (
            <p className="text-body text-muted-foreground">{copy.manualBody}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              <Step n={1} title={bookedCopy.printStep}>
                {label ? bookedCopy.printStepHelp : copy.noLabel}
              </Step>
              <Step n={2} title={bookedCopy.pickupStep}>
                {canAskPickup && !onCreatePickup ? pickupCopy.fromBooked : pickupHelp}
              </Step>
            </ol>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {label ? (
            <Button
              render={<a href={label} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <Printer aria-hidden />
              {bookedCopy.printLabel}
            </Button>
          ) : null}
          {canAskPickup && onCreatePickup ? (
            <Button variant="outline" onClick={onCreatePickup}>
              {bookedCopy.createPickup}
            </Button>
          ) : null}
          {booked.trackingUrl && booked.manual ? (
            <Button
              variant="outline"
              render={<a href={booked.trackingUrl} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <ExternalLink aria-hidden />
              {copy.track}
            </Button>
          ) : null}
          {backHref ? (
            <Button variant="ghost" render={<Link href={backHref} />} nativeButton={false}>
              {bookedCopy.backToOrders}
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  )
}

/** One Shipment row: label and its grey note on the left, the value on the right. */
function Fact({
  label,
  note,
  children,
}: {
  label: string
  note?: string | null | undefined
  children: ReactNode
}) {
  // Render logic
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="flex min-w-0 gap-2">
        <span className="text-ink-strong">{label}</span>
        {note ? <span className="truncate text-muted-foreground">{note}</span> : null}
      </dt>
      <dd className="text-right text-ink-strong tabular-nums">{children}</dd>
    </div>
  )
}

/** One numbered Next step. */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  // Render logic
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-medium text-ink-strong">
        {n}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-medium text-ink-strong">{title}</span>
        <span className="text-caption text-muted-foreground">{children}</span>
      </span>
    </li>
  )
}
