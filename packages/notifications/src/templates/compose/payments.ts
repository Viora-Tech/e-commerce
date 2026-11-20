import type { EmailBlock } from '../../emails/blocks'
import type { TemplateData, TemplateId } from '../../types'
import { sharedContent as shared } from '../content'
import { blockCopy } from '../content-blocks'
import type { Composer } from './index'
import {
  button,
  instructionRows,
  orderColumns,
  orderItems,
  present,
  routeTicket,
  shopButton,
} from './order'

/**
 * Batch 5, payments: a status or two big numbers for the money (paid, due, refunded), the pay
 * button, then the order. Transfer messages list how to pay; balance messages show what was paid
 * so far and what is left.
 */
const c = () => blockCopy.payments

/** The order's reference after the #: "D57" while it is a draft. */
const ref = (d: TemplateData) => (d.draftNumber ? `D${d.draftNumber}` : String(d.orderNumber))

/** How to pay a transfer, as label / value rows, or nothing without instructions. */
function howToPay(d: TemplateData): EmailBlock | null {
  const lines = d.paymentInstructions ?? []
  return lines.length > 0 ? { kind: 'facts', look: 'soft', rows: instructionRows(lines) } : null
}

const received: Composer = (d, action) => ({
  eyebrow: c().paidKicker(d.orderNumber),
  blocks: present([
    {
      kind: 'status',
      tone: 'good',
      title: c().paidInFull,
      body: d.paymentMethodLabel
        ? d.paymentRef
          ? c().paidRef(d.paymentMethodLabel, d.paymentRef)
          : c().paidBy(d.paymentMethodLabel)
        : undefined,
    },
    button(action),
    orderItems(d, { title: c().yourOrder }),
  ]),
})

const pending: Composer = (d, action) => ({
  eyebrow: c().pendingKicker(d.orderNumber),
  lead: c().pendingLead,
  blocks: present([
    { kind: 'notice', tone: 'accent', title: c().pageClosed, body: c().pageClosedBody },
    button(action),
    orderItems(d, { title: c().waitingInOrder, totals: false }),
  ]),
})

const reminder: Composer = (d, action) => ({
  eyebrow: c().holdKicker(d.orderNumber),
  blocks: present([
    howToPay(d),
    d.paymentInstructions?.length
      ? {
          kind: 'status',
          tone: 'accent',
          title: c().putInNote(`#${ref(d)}`),
          body: c().putInNoteBody,
        }
      : null,
    button(action),
    orderItems(d, { title: c().yourOrder, totals: false }),
  ]),
})

const transferRequested: Composer = (d, action) => ({
  eyebrow: c().receivedKicker(d.orderNumber),
  blocks: present([
    {
      kind: 'stats',
      items: [
        { label: c().amountToPay, value: d.totalLabel, tone: 'accent' },
        ...(d.deadlineLabel ? [{ label: c().payBy, value: d.deadlineLabel }] : []),
      ],
    },
    howToPay(d),
    button(action),
    orderItems(d, { title: c().yourOrder, totals: false }),
  ]),
})

const codConfirm: Composer = (d, action) => {
  const city = d.shipTo?.[d.shipTo.length - 1]
  return {
    eyebrow: c().codKicker(d.orderNumber),
    blocks: present([
      {
        kind: 'stats',
        items: [
          { label: c().payOnDelivery, value: d.totalLabel, tone: 'accent' },
          ...(city ? [{ label: c().deliveryTo, value: city }] : []),
        ],
      },
      // The confirm page has both answers; "Cancel it" opens the same page.
      action
        ? {
            kind: 'button',
            label: c().confirmOrder,
            url: action.url,
            secondary: { label: c().cancelIt, url: action.url },
          }
        : null,
      orderItems(d, { title: c().yourOrder, totals: false }),
    ]),
  }
}

const payOnline: Composer = (d, action) => ({
  eyebrow: c().payOnlineKicker(d.orderNumber),
  lead: c().payOnlineLead,
  blocks: present([
    {
      kind: 'notice',
      tone: 'accent',
      title: c().payOnlineTitle(d.totalLabel),
      body: c().payOnlineBody,
    },
    button(action, c().payOnline(d.totalLabel)),
    orderItems(d, { title: c().yourOrder, totals: false }),
  ]),
})

const balanceDue: Composer = (d, action) => {
  const b = d.balance
  const edit = b?.kind === 'edit'
  return {
    eyebrow: c().balanceKicker(d.orderNumber, edit),
    blocks: present([
      b
        ? {
            kind: 'stats',
            items: [
              { label: c().paidSoFar, value: b.depositLabel },
              { label: c().balanceDue, value: b.dueLabel, tone: 'accent' },
            ],
          }
        : null,
      button(action),
      orderItems(d, { title: edit ? c().yourOrder : c().yourPreorder, totals: false }),
    ]),
  }
}

const balanceReminder: Composer = (d, action) => {
  const b = d.balance
  return {
    eyebrow: c().reminderKicker(d.orderNumber, b?.kind === 'edit'),
    blocks: present([
      b
        ? {
            kind: 'facts',
            rows: [
              { label: c().orderTotal, value: d.totalLabel },
              { label: c().paidSoFar, value: b.depositLabel },
              { label: c().balanceDue, value: b.dueLabel, strong: true },
              ...(b.payByLabel ? [{ label: c().payBy, value: b.payByLabel }] : []),
            ],
          }
        : null,
      button(action),
      orderItems(d, { totals: false }),
    ]),
  }
}

const balanceReceived: Composer = (d, action) => ({
  eyebrow: c().balanceReceivedKicker(d.orderNumber),
  blocks: present([
    {
      kind: 'status',
      tone: 'good',
      title: c().paidInFullTotal(d.totalLabel),
      body: c().shipsWhenStock,
    },
    routeTicket(d, {
      progress: 'waiting',
      meta: [
        { label: shared.ticket.order, value: `#${d.orderNumber}` },
        { label: shared.ticket.status, value: c().awaitingStock },
        ...(d.route?.etaLabel ? [{ label: shared.ticket.expected, value: d.route.etaLabel }] : []),
      ],
    }),
    button(action),
    orderItems(d, { title: c().yourPreorder, totals: false }),
  ]),
})

const refundIssued: Composer = (d, action) => {
  const r = d.refund
  return {
    eyebrow: c().refundKicker(d.orderNumber),
    blocks: present([
      r
        ? {
            kind: 'stats',
            items: [
              { label: c().refunded, value: r.amountLabel, tone: 'good' },
              { label: c().reachesIn, value: r.etaLabel ?? c().rightAway },
            ],
          }
        : null,
      r ? { kind: 'facts', rows: [{ label: c().refundedTo, value: r.methodLabel }] } : null,
      button(action),
    ]),
  }
}

const draftInvoice: Composer = (d, action) => {
  const sc = d.storeCredit
  const credit =
    sc?.appliedLabel && sc.toPayLabel
      ? [
          { label: shared.storeCredit.applied, amount: sc.appliedLabel },
          { label: shared.storeCredit.toPay, amount: sc.toPayLabel },
        ]
      : undefined
  const file = d.links?.[0]
  return {
    eyebrow: c().draftKicker(ref(d)),
    blocks: present([
      file
        ? {
            kind: 'attachment',
            badge: blockCopy.updates.pdf,
            name: c().draftFile(ref(d)),
            link: { label: blockCopy.updates.download, url: file.url },
          }
        : null,
      orderItems(d, { title: c().yourOrder, afterTotal: credit }),
      button(action, blockCopy.updates.pay(sc?.toPayLabel ?? d.totalLabel)),
      orderColumns(d),
    ]),
  }
}

const unpaidCancelled: Composer = (d, action) => ({
  eyebrow: c().unpaidCancelledKicker(d.orderNumber),
  blocks: present([
    { kind: 'notice', tone: 'bad', title: c().notReceived, body: c().notReceivedBody },
    shopButton(d, c().orderAgain, action),
    orderItems(d, { title: blockCopy.updates.cancelledItems, totals: false }),
  ]),
})

export const paymentComposers: Partial<Record<TemplateId, Composer>> = {
  payment_received: received,
  payment_pending: pending,
  payment_reminder: reminder,
  transfer_requested: transferRequested,
  cod_confirm: codConfirm,
  cod_pay_online: payOnline,
  balance_request: balanceDue,
  balance_reminder: balanceReminder,
  balance_received: balanceReceived,
  refund_issued: refundIssued,
  draft_invoice: draftInvoice,
  unpaid_cancelled: unpaidCancelled,
}
