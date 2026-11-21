import type { EmailBlock } from '../../emails/blocks'
import type { TemplateData, TemplateId } from '../../types'
import { blockCopy } from '../content-blocks'
import type { Composer } from './index'
import { button, itemCount, orderItems, parcelsList, present, routeTicket, shopperName } from './order'

/**
 * Batch 3, delivery tickets: the route ticket with the courier, AWB and arrival, the tracking
 * button, then what is in the parcel. An order with no route (several parcels, no address) shows
 * the same facts in a plain card instead.
 */
const c = () => blockCopy.delivery

/** Courier · AWB · Arrives, leaving out what is not known yet. */
function trackingMeta(
  d: TemplateData,
  opts: { awbLabel?: string | undefined; arrives?: string | undefined } = {},
): { label: string; value: string }[] {
  const courier = d.courierLabel ?? d.route?.via
  const arrives = opts.arrives ?? d.route?.etaLabel
  return [
    ...(courier ? [{ label: c().courier, value: courier }] : []),
    ...(d.waybill ? [{ label: opts.awbLabel ?? c().awb, value: d.waybill }] : []),
    ...(arrives ? [{ label: c().arrives, value: arrives }] : []),
  ]
}

/** Delivered · Courier · AWB for the delivered ticket. */
function deliveredMeta(d: TemplateData): { label: string; value: string }[] {
  const courier = d.courierLabel ?? d.route?.via
  return [
    ...(d.deliveredLabel ? [{ label: c().delivered, value: d.deliveredLabel }] : []),
    ...(courier ? [{ label: c().courier, value: courier }] : []),
    ...(d.waybill ? [{ label: c().awb, value: d.waybill }] : []),
  ]
}

/** A plane for an air service, a truck otherwise. */
const vehicle = (d: TemplateData) => (/air|express/i.test(d.route?.via ?? '') ? 'plane' : 'truck')

/** The ticket, or the same facts as rows when the order has no single route. */
function ticketOrFacts(
  d: TemplateData,
  meta: { label: string; value: string }[],
  opts: {
    progress: 'moving' | 'done'
    via?: string | undefined
    foot?: { line: string; note?: string | undefined } | undefined
  },
): EmailBlock | null {
  const ticket = routeTicket(d, { meta, vehicle: vehicle(d), ...opts })
  if (ticket) return ticket
  return meta.length > 0 ? { kind: 'facts', rows: meta } : null
}

const shipped: Composer = (d, action) => ({
  eyebrow: c().shippedKicker(d.orderNumber),
  heading: c().shippedHeading,
  lead: c().shippedLead,
  blocks: present([
    ticketOrFacts(d, trackingMeta(d), {
      progress: 'moving',
      foot: { line: itemCount(d), note: c().shippedNote },
    }),
    parcelsList(d),
    button(action, d.trackingUrl ? c().trackParcel : undefined),
    orderItems(d, { title: c().inThisParcel, totals: false }),
  ]),
})

const outForDelivery: Composer = (d, action) => ({
  eyebrow: c().outKicker(d.orderNumber),
  heading: c().outHeading,
  lead: c().outLead(d.courierLabel),
  blocks: present([
    ticketOrFacts(d, trackingMeta(d, { arrives: c().today }), {
      progress: 'moving',
      via: c().outForDelivery,
      foot: { line: c().outLine(itemCount(d)), note: c().outNote },
    }),
    d.paymentState === 'cod'
      ? { kind: 'notice', tone: 'accent', title: c().keepReady(d.totalLabel), body: c().keepReadyBody }
      : null,
    button(action, d.trackingUrl ? c().trackParcel : undefined),
    orderItems(d, { title: c().inThisParcel, totals: false }),
  ]),
})

const delivered: Composer = (d, action) => ({
  eyebrow: c().deliveredKicker(d.orderNumber),
  heading: c().deliveredHeading(shopperName(d)),
  lead: d.deliveredLabel ? c().deliveredOn(d.deliveredLabel) : undefined,
  blocks: present([
    ticketOrFacts(d, deliveredMeta(d), {
      progress: 'done',
      via: c().delivered,
      foot: { line: c().deliveredLine(itemCount(d)), note: c().deliveredNote },
    }),
    button(action),
    orderItems(d, { title: c().whatYouGot, totals: false }),
  ]),
})

const failed: Composer = (d, action) => {
  const reason = d.deliveryIssue?.reasonLabel
  return {
    eyebrow: c().failedKicker(d.orderNumber),
    heading: c().failedHeading,
    lead: c().failedLead,
    blocks: present([
      {
        kind: 'notice',
        tone: 'bad',
        title: reason ? c().failedReason(reason) : c().failedTitle,
        body: c().failedBody,
      },
      button(action, d.trackingUrl ? c().trackParcel : undefined),
      orderItems(d, { title: c().inThisParcel, totals: false }),
    ]),
  }
}

const shippingUpdate: Composer = (d, action) => ({
  eyebrow: c().updateKicker(d.orderNumber),
  lead: c().updateLead,
  blocks: present([
    ticketOrFacts(d, trackingMeta(d, { awbLabel: c().newAwb }), {
      progress: 'moving',
      foot: d.previousWaybill
        ? {
            line: c().oldAwb(d.previousWaybill),
            note: d.courierLabel ? c().movedTo(d.courierLabel) : undefined,
          }
        : d.courierLabel
          ? { line: c().movedTo(d.courierLabel) }
          : undefined,
    }),
    button(action, d.trackingUrl ? c().trackParcel : undefined),
    orderItems(d, { title: c().inThisParcel, totals: false }),
  ]),
})

const split: Composer = (d, action) => ({
  eyebrow: c().splitKicker(d.orderNumber, Math.max(d.parcels?.length ?? 2, 2)),
  blocks: present([
    parcelsList(d, true) ?? orderItems(d, { totals: false }),
    button(action, d.trackingUrl ? c().trackOrder : undefined),
  ]),
})

export const deliveryComposers: Partial<Record<TemplateId, Composer>> = {
  order_shipped: shipped,
  out_for_delivery: outForDelivery,
  delivered,
  delivery_failed: failed,
  shipping_update: shippingUpdate,
  order_split: split,
}
