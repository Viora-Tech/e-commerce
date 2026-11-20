import type { TicketBlock } from '../../emails/blocks'
import { emailAsset } from '../../emails/theme'
import type { TemplateData, TemplateId } from '../../types'
import { blockCopy } from '../content-blocks'
import { blockCopy2 } from '../content-blocks-2'
import type { Composer } from './index'
import { button, muted, orderItems, present, routeTicket, shopperName } from './order'

/**
 * Batch 6, returns: the route ticket run backwards (from the shopper's city back to the
 * warehouse) while the parcel comes back, a box for a decision or a refund, then the items going
 * back. An exchange is a new order, so its ticket runs forwards again.
 */
const c = () => blockCopy2.returns

const kicker = (d: TemplateData, state: string) =>
  d.returnInfo ? c().kicker(d.returnInfo.label, state) : `Order #${d.orderNumber} · ${state}`

/** Pickup from (the shopper) → Back to (the warehouse), or null when the order has no route. */
function returnTicket(
  d: TemplateData,
  opts: Pick<TicketBlock, 'meta' | 'foot' | 'progress'> & { via?: string | undefined },
): TicketBlock | null {
  const r = d.route
  if (!r) return null
  return {
    kind: 'ticket',
    labels: { from: c().pickupFrom, to: c().backTo },
    from: r.to,
    fromNote: r.toNote,
    to: r.from,
    toNote: r.fromNote,
    via: opts.via,
    meta: opts.meta,
    foot: opts.foot,
    progress: opts.progress,
    vehicleSrc: opts.progress === 'waiting' ? null : emailAsset(d.brand?.shopUrl, 'truck'),
  }
}

const returning = (d: TemplateData) => orderItems(d, { title: c().youAreReturning, totals: false })

const requested: Composer = (d, action) => {
  const info = d.returnInfo
  return {
    eyebrow: kicker(d, c().requested),
    blocks: present([
      returnTicket(d, {
        progress: 'waiting',
        via: c().notPickedUp,
        meta: [
          { label: c().status, value: c().waitingApproval },
          ...(info?.reasonLabel ? [{ label: c().reason, value: info.reasonLabel }] : []),
          ...(info ? [{ label: c().return, value: info.label }] : []),
        ],
        foot: { line: c().keepInBox, note: c().keepInBoxNote },
      }),
      returning(d),
      button(action),
    ]),
  }
}

const approved: Composer = (d, action) => {
  const info = d.returnInfo
  const courier = info?.pickup === 'courier'
  const ticket = courier
    ? returnTicket(d, {
        progress: 'moving',
        meta: info?.pickupWaybill
          ? [{ label: c().pickupAwb, value: info.pickupWaybill }]
          : [{ label: c().status, value: c().courierPickup }],
        foot: { line: c().packIt, note: c().labelNote },
      })
    : null
  return {
    eyebrow: kicker(d, c().approved),
    blocks: present([
      ticket ??
        (courier
          ? { kind: 'notice', tone: 'accent', title: c().packIt, body: c().labelNote }
          : { kind: 'notice', tone: 'accent', title: c().sendBack, body: c().sendBackBody }),
      returning(d),
      button(action),
    ]),
  }
}

const rejected: Composer = (d, action) => ({
  eyebrow: kicker(d, c().notAccepted),
  lead: c().sorry(shopperName(d)),
  blocks: present([
    d.returnInfo?.decisionNote
      ? { kind: 'notice', tone: 'bad', title: c().why, body: d.returnInfo.decisionNote }
      : null,
    muted(c().gotItWrong),
    orderItems(d, { totals: false }),
    button(action),
  ]),
})

const received: Composer = (d, action) => ({
  eyebrow: kicker(d, c().received),
  blocks: present([
    returnTicket(d, {
      progress: 'done',
      via: c().arrived,
      meta: d.returnInfo ? [{ label: c().return, value: d.returnInfo.label }] : [],
    }),
    { kind: 'status', tone: 'good', title: c().accepted, body: c().acceptedBody },
    orderItems(d, { totals: false }),
    button(action),
  ]),
})

const refunded: Composer = (d, action) => {
  const info = d.returnInfo
  return {
    eyebrow: kicker(d, c().refunded),
    blocks: present([
      info?.refundLabel
        ? {
            kind: 'stats',
            items: [
              { label: c().refunded, value: info.refundLabel, tone: 'good' },
              {
                label: c().refundedTo,
                value: info.refundMethod === 'store_credit' ? c().storeCredit : c().original,
              },
            ],
          }
        : null,
      orderItems(d, { totals: false }),
      button(action),
    ]),
  }
}

const exchanged: Composer = (d, action) => ({
  eyebrow: kicker(d, c().exchange),
  blocks: present([
    routeTicket(d, {
      progress: 'moving',
      meta: [
        { label: c().newOrder, value: `#${d.orderNumber}` },
        ...(d.route?.via ? [{ label: blockCopy.delivery.courier, value: d.route.via }] : []),
        ...(d.route?.etaLabel ? [{ label: blockCopy.delivery.arrives, value: d.route.etaLabel }] : []),
      ],
      foot: { line: c().replacementFor(d.returnInfo?.originalOrderNumber) },
    }),
    orderItems(d, { title: c().sendingYou, totals: false }),
    button(action, d.trackingUrl ? c().trackExchange : undefined),
  ]),
})

export const returnComposers: Partial<Record<TemplateId, Composer>> = {
  return_requested: requested,
  return_approved: approved,
  return_rejected: rejected,
  return_received: received,
  return_refunded: refunded,
  return_exchanged: exchanged,
}
