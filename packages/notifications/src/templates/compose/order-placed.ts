import type { TemplateData } from '../../types'
import { sharedContent as shared } from '../content'
import { invoiceFile, whatsappButton } from './contact'
import type { Composed } from './index'
import {
  instructionRows,
  itemCount,
  orderColumns,
  orderItems,
  parcelsList,
  present,
  routeTicket,
} from './order'

/**
 * Order placed (Figma batch 1): the ticket from the warehouse to the shopper, the button, the
 * order and its totals, then Shipping to · Payment · Ordered on. A paid order is "Packing now";
 * cash on delivery says what to keep ready; an unpaid transfer stays grey with where to pay.
 */
export function orderPlaced(d: TemplateData, action?: { label: string; url: string }): Composed {
  const t = shared.ticket
  const unpaid = d.paymentState === 'unpaid'
  const cod = d.paymentState === 'cod'
  const ticket = routeTicket(d, {
    progress: unpaid ? 'waiting' : 'moving',
    meta: [
      { label: t.order, value: `#${d.orderNumber}` },
      { label: t.status, value: unpaid ? t.waitingPayment : t.packing },
      {
        label: t.expected,
        value: unpaid ? t.afterPayment : (d.route?.etaLabel ?? t.soon),
      },
    ],
    foot: unpaid
      ? { line: d.paymentInstructions?.[0] ?? t.waitingPayment, note: t.unpaidNote }
      : {
          line: `${itemCount(d)}  ·  ${cod ? t.payOnDelivery(d.totalLabel) : t.paidBy(d.totalLabel, d.paymentMethodLabel)}`,
          note: cod ? t.codNote : t.paidNote,
        },
  })
  const instructions = unpaid && (d.paymentInstructions?.length ?? 0) > 1
  return {
    eyebrow: `Order #${d.orderNumber} · ${unpaid ? t.awaitingPayment : t.confirmed}`,
    blocks: present([
      ticket,
      parcelsList(d),
      action ? { kind: 'button', label: action.label, url: action.url } : null,
      invoiceFile(d),
      orderItems(d),
      orderColumns(d),
      instructions
        ? {
            kind: 'facts',
            rows: instructionRows(d.paymentInstructions ?? []),
          }
        : null,
      whatsappButton(d, { note: true }),
    ]),
  }
}
