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

/**
 * The order list with subtotal, discount, shipping ("Free" when nothing was charged) and total.
 * `title` renames the divider ("In this parcel"); `totals: false` lists the items alone.
 */
export function orderItems(
  d: TemplateData,
  opts: {
    title?: string | undefined
    totals?: boolean | undefined
    totalHeading?: string | undefined
    afterTotal?: { label: string; amount: string }[] | undefined
  } = {},
): ItemsBlock | null {
  if (d.lines.length === 0) return null
  const totals = opts.totals !== false
  return {
    kind: 'items',
    title: opts.title ?? shared.itemsTitle,
    lines: d.lines,
    qty: shared.qty,
    totalHeading: opts.totalHeading ?? shared.totalLabel,
    totalLabel: totals ? d.totalLabel : undefined,
    subtotal:
      d.subtotalLabel && d.subtotalLabel !== d.totalLabel
        ? { label: t().subtotal, amount: d.subtotalLabel }
        : undefined,
    discount: d.discount,
    shipping: d.shipping ?? (d.route ? { label: t().shipping, amount: t().free } : undefined),
    taxBreakdown: d.taxBreakdown,
    afterTotal: opts.afterTotal,
  }
}

/** The centred button, or nothing without a link. */
export function button(
  action: { label: string; url: string } | undefined | null,
  label?: string | undefined,
): EmailBlock | null {
  return action ? { kind: 'button', label: label ?? action.label, url: action.url } : null
}

/** The store's home page as a button ("Shop again"), falling back to the message's own action. */
export function shopButton(
  d: TemplateData,
  label: string,
  fallback?: { label: string; url: string } | undefined,
): EmailBlock | null {
  const shop = d.brand?.shopUrl
  return shop ? { kind: 'button', label, url: shop } : button(fallback)
}

/** The small italic line at the end of a message. */
export function muted(text: string | undefined | null): EmailBlock | null {
  return text ? { kind: 'text', text, muted: true } : null
}

/** "UPI ID: shop@okicici" reads as a label and a value; a plain line keeps its words. */
export function instructionRows(lines: string[]): { label: string; value: string }[] {
  return lines.map((line) => {
    const at = line.indexOf(': ')
    return at > 0 ? { label: line.slice(0, at), value: line.slice(at + 2) } : { label: '', value: line }
  })
}

/** How it is paid, as the Payment column says it: "UPI · paid", "Cash on delivery". */
export function paymentLine(d: TemplateData): string {
  if (d.paymentState === 'cod') return d.paymentMethodLabel
  if (d.paymentState === 'unpaid') return t().unpaid(d.paymentMethodLabel)
  if (d.paymentState === 'paid') return t().paid(d.paymentMethodLabel)
  return d.paymentMethodLabel
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

/** An intro's first paragraph, when the rest of it moved into blocks. */
export function firstParagraph(text: string): string {
  return text.split(/\n\s*\n/)[0] ?? text
}

/** Drops the blocks a message has no data for. */
export function present(blocks: (EmailBlock | null | undefined | false)[]): EmailBlock[] {
  return blocks.filter((b): b is EmailBlock => Boolean(b))
}

/**
 * "Ships in 2 parcels": each parcel, where it leaves from, when it comes and what is in it.
 * Nothing for an order that ships in one. `split` is a split to send the ready items first.
 */
export function parcelsList(d: TemplateData, split = false): EmailBlock | null {
  const parcels = d.parcels ?? []
  if (parcels.length < 2) return null
  const p = shared.parcels
  return {
    kind: 'parcels',
    title: p.title(parcels.length),
    note: split ? p.splitNote : p.note,
    parcels: parcels.map((parcel, i) => ({
      heading: p.parcel(i + 1, parcel.from),
      when: parcel.onHold ? p.onHold : parcel.dateRange ? p.arrives(parcel.dateRange) : null,
      items: parcel.items.map((item) => p.item(item.quantity, item.title)),
    })),
  }
}

/** The shopper's first name for a heading, or empty for an order with none ("there"). */
export function shopperName(d: TemplateData): string {
  return d.customerName && d.customerName !== 'there' ? d.customerName : ''
}
