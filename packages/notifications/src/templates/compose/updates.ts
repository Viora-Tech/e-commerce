import type { TemplateId } from '../../types'
import { sharedContent } from '../content'
import { blockCopy } from '../content-blocks'
import type { Composer } from './index'
import { button, orderItems, paymentLine, present, shopButton } from './order'

/**
 * Batch 4, order updates: a cancelled order with its refund, an edited order as it stands now,
 * the order link, a document copy and a gift card. Each is one box that says what happened, the
 * button, then the items.
 */
const c = () => blockCopy.updates

const cancelled: Composer = (d, action) => ({
  eyebrow: c().cancelledKicker(d.orderNumber),
  blocks: present([
    d.refund
      ? {
          kind: 'status',
          tone: 'good',
          title: c().refundBack(d.refund.amountLabel),
          body: c().refundTo(d.refund.methodLabel, d.refund.etaLabel),
        }
      : null,
    shopButton(d, c().shopAgain, action),
    orderItems(d, { title: c().cancelledItems, totals: false }),
  ]),
})

const edited: Composer = (d, action) => {
  // The new total is higher than what was paid: the extra is due, with its own pay link.
  const due = d.balance?.kind === 'edit' ? d.balance : undefined
  return {
    eyebrow: c().editedKicker(d.orderNumber),
    blocks: present([
      { kind: 'notice', tone: 'accent', title: c().whatChanged, body: c().newTotal(d.totalLabel) },
      orderItems(d, { title: c().orderNow, totalHeading: c().newTotalLabel }),
      due ? { kind: 'text', text: c().leftToPay(due.depositLabel, due.dueLabel), muted: true } : null,
      due && d.actionUrl
        ? { kind: 'button', label: c().pay(due.dueLabel), url: d.actionUrl }
        : button(action),
    ]),
  }
}

const orderLink: Composer = (d, action) => ({
  eyebrow: c().linkKicker(d.orderNumber),
  blocks: present([
    {
      kind: 'facts',
      rows: [
        { label: c().order, value: `#${d.orderNumber}` },
        { label: c().total, value: d.totalLabel, strong: true },
        { label: c().payment, value: paymentLine(d) },
      ],
    },
    button(action, c().openOrder),
    orderItems(d, { totals: false }),
  ]),
})

const documentCopy: Composer = (d) => {
  const file = d.links?.[0]
  return {
    eyebrow: c().documentKicker(d.orderNumber),
    blocks: present([
      {
        kind: 'attachment',
        badge: c().pdf,
        name: c().documentName(d.documentLabel),
        meta: c().documentMeta(d.orderNumber),
        link: file ? { label: c().download, url: file.url } : undefined,
      },
      d.totalLabel
        ? { kind: 'facts', rows: [{ label: c().totalInclGst, value: d.totalLabel, strong: true }] }
        : null,
      d.orderUrl ? { kind: 'button', label: sharedContent.viewOrder, url: d.orderUrl } : null,
    ]),
  }
}

const giftCard: Composer = (d, action) => {
  const gc = d.giftCard
  return {
    eyebrow: c().giftKicker,
    blocks: present([
      gc
        ? {
            kind: 'coupon',
            label: c().giftCode,
            code: gc.code,
            note: c().giftNote(gc.expiresLabel),
            value: gc.balanceLabel,
            valueNote: c().giftValueNote,
          }
        : null,
      gc?.message ? { kind: 'quote', label: c().giftMessage, text: gc.message, tone: 'accent' } : null,
      shopButton(d, c().startShopping, action),
    ]),
  }
}

export const updateComposers: Partial<Record<TemplateId, Composer>> = {
  order_cancelled: cancelled,
  order_edited: edited,
  order_link: orderLink,
  document_copy: documentCopy,
  gift_card_issued: giftCard,
}
