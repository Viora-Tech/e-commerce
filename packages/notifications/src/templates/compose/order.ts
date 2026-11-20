import type { EmailBlock, ItemsBlock, TicketBlock } from '../../emails/blocks'
import { emailAsset } from '../../emails/theme'
import type { TemplateData } from '../../types'
import { sharedContent as shared } from '../content'

/**
 * Shared pieces for order emails, so each order message is a few lines of blocks: the route
 * ticket, the order list with its totals and the facts under it. Used by Order placed now and
 * by the delivery, payment and update emails as their batches move over.
 */

const t = () => shared.ticket

/** The items bought, counting quantities: "2 items". */
export function itemCount(d: TemplateData): string {
  return t().items(d.lines.reduce((n, l) => n + l.quantity, 0))
}

/** The route ticket from `d.route`, or null when the order has none (gift card, several parcels). */
export function routeTicket(
  d: TemplateData,
  opts: {
    meta: TicketBlock['meta']
    foot?: TicketBlock['foot']
    progress: TicketBlock['progress']
    vehicle?: 'truck' | 'plane' | undefined
    /** Under the vehicle; the courier service by default. */
    via?: string | undefined
  },
): TicketBlock | null {
  const r = d.route
  if (!r) return null
  return {
    kind: 'ticket',
    labels: { from: t().from, to: t().to },
    from: r.from,
    fromNote: r.fromNote,
    to: r.to,
    toNote: r.toNote,
    via: opts.via ?? r.via,
    meta: opts.meta,
    foot: opts.foot,
    progress: opts.progress,
    vehicleSrc:
      opts.progress === 'waiting' ? null : emailAsset(d.brand?.shopUrl, opts.vehicle ?? 'truck'),
  }
}

/** The order list with subtotal, discount, shipping ("Free" when nothing was charged) and total. */
export function orderItems(d: TemplateData): ItemsBlock | null {
  if (d.lines.length === 0) return null
  return {
    kind: 'items',
    title: shared.itemsTitle,
    lines: d.lines,
    qty: shared.qty,
    totalHeading: shared.totalLabel,
    totalLabel: d.totalLabel,
    subtotal:
      d.subtotalLabel && d.subtotalLabel !== d.totalLabel
        ? { label: t().subtotal, amount: d.subtotalLabel }
        : undefined,
    discount: d.discount,
    shipping: d.shipping ?? (d.route ? { label: t().shipping, amount: t().free } : undefined),
    taxBreakdown: d.taxBreakdown,
  }
}

/** How it is paid, as the Payment column says it: "UPI · paid", "Cash on delivery". */
export function paymentLine(d: TemplateData): string {
  if (d.paymentState === 'cod') return d.paymentMethodLabel
  if (d.paymentState === 'unpaid') return t().unpaid(d.paymentMethodLabel)
  return t().paid(d.paymentMethodLabel)
}

/** Shipping to · Payment · Ordered on. */
export function orderColumns(d: TemplateData): EmailBlock {
  return {
    kind: 'columns',
    items: [
      ...(d.shipTo?.length ? [{ label: t().shippingTo, lines: d.shipTo }] : []),
      { label: t().payment, lines: [paymentLine(d)] },
      ...(d.placedLabel ? [{ label: t().orderedOn, lines: [d.placedLabel] }] : []),
    ],
  }
}

/** Drops the blocks a message has no data for. */
export function present(blocks: (EmailBlock | null | undefined | false)[]): EmailBlock[] {
  return blocks.filter((b): b is EmailBlock => Boolean(b))
}
