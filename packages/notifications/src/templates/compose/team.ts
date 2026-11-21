import type { EmailBlock } from '../../emails/blocks'
import type { TemplateData, TemplateId } from '../../types'
import { blockCopy } from '../content-blocks'
import { blockCopy2 } from '../content-blocks-2'
import type { Composer } from './index'
import { button, muted, orderItems, paymentLine, present, routeTicket } from './order'

/**
 * Batch 9, team and platform mail, and the daily summary from batch 10: the facts the reader
 * acts on in a card, the shopper's words in a quote box, one button to the admin.
 */
const c = () => blockCopy2.team

/** Label / value rows, leaving out the ones with no value. */
function rows(list: [string, string | undefined | null][]): EmailBlock | null {
  const kept = list.filter((r): r is [string, string] => Boolean(r[1]))
  return kept.length > 0
    ? { kind: 'facts', look: 'soft', rows: kept.map(([label, value]) => ({ label, value })) }
    : null
}

const newOrder: Composer = (d, action) => ({
  eyebrow: c().newOrderKicker,
  lead: c().newOrderLead(d.shipTo?.[0] ?? d.customerName, d.totalLabel, paymentLine(d)),
  blocks: present([
    {
      kind: 'stats',
      items: [
        { label: c().orderTotal, value: d.totalLabel, tone: 'accent' },
        { label: c().payment, value: paymentLine(d) },
      ],
    },
    orderItems(d, { totals: false }),
    routeTicket(d, {
      progress: 'moving',
      meta: [
        { label: c().order, value: `#${d.orderNumber}` },
        ...(d.route?.via ? [{ label: c().delivery, value: d.route.via }] : []),
      ],
      foot: d.shipTo?.length
        ? { line: c().shipTo(d.shipTo.join(', ')), note: c().bookCourier }
        : undefined,
    }),
    button(action),
  ]),
})

const formMessage: Composer = (d) => {
  const m = d.contactMessage
  return {
    eyebrow: c().formKicker,
    lead: m?.path ? c().formLead(m.path) : undefined,
    blocks: present([
      rows([
        [c().name, m?.name],
        [c().email, m?.email],
        [c().phone, m?.phone],
      ]),
      m?.text ? { kind: 'quote', label: c().theyWrote, text: m.text } : null,
    ]),
  }
}

const questionAsked: Composer = (d, action) => {
  const r = d.review
  return {
    eyebrow: c().questionKicker,
    lead: blockCopy2.marketing.questionLead(r?.productTitle) || undefined,
    blocks: present([
      r?.question
        ? { kind: 'quote', label: c().asked(r.askerName), text: r.question, tone: 'accent' }
        : null,
      r?.askerEmail ? rows([[c().email, r.askerEmail]]) : null,
      button(action),
    ]),
  }
}

const affiliateApplication: Composer = (d) => {
  const a = d.affiliate
  return {
    eyebrow: c().affiliatesKicker,
    lead: c().affiliateLead,
    blocks: present([
      rows([
        [c().name, a?.name],
        [c().email, a?.email],
        [c().postsOn, a?.social],
        [c().whyJoin, a?.message],
      ]),
      a?.adminUrl ? { kind: 'button', label: c().approve, url: a.adminUrl } : null,
    ]),
  }
}

const unpaidNotice: Composer = (d, action) => ({
  eyebrow: c().unpaidKicker,
  blocks: present([
    {
      kind: 'notice',
      tone: 'bad',
      title: d.deadlineLabel ? c().cancelsOn(d.deadlineLabel) : c().cancelsSoon,
      body: c().cancelsBody,
    },
    button(action),
    orderItems(d, { totals: false }),
  ]),
})

const purchaseOrder: Composer = (d) => {
  const po = d.purchaseOrder
  return {
    eyebrow: c().poKicker(po?.numberLabel),
    blocks: present([
      po
        ? { kind: 'attachment', badge: blockCopy.updates.pdf, name: `${po.numberLabel}.pdf` }
        : null,
      {
        kind: 'facts',
        rows: [
          ...(po ? [{ label: c().poNumber, value: po.numberLabel }] : []),
          { label: c().total, value: d.totalLabel, strong: true },
          ...(po?.expectedLabel ? [{ label: c().expectedBy, value: po.expectedLabel }] : []),
        ],
      },
      orderItems(d, { totals: false }),
      po?.message ? { kind: 'text', text: po.message } : null,
    ]),
  }
}

const invitation: Composer = (d, action) => {
  const inv = d.staffInvite
  return {
    eyebrow: c().inviteKicker,
    blocks: present([
      button(action),
      rows([
        [c().store, d.storeName],
        [c().role, inv?.roleLabel],
        [c().invitedBy, inv?.inviterEmail],
      ]),
      muted(c().signInWith),
    ]),
  }
}

const planBill: Composer = (d, action) => {
  const b = d.planBill
  return {
    eyebrow: c().billKicker,
    blocks: present([
      b
        ? {
            kind: 'facts',
            rows: [
              { label: c().amount, value: b.amountLabel, strong: true },
              { label: c().due, value: b.dueLabel },
              { label: c().billFor, value: b.what },
            ],
          }
        : null,
      button(action),
    ]),
  }
}

const bugReport: Composer = (d, action) => {
  const r = d.bugReport
  return {
    eyebrow: c().bugKicker,
    blocks: present([
      r
        ? {
            kind: 'status',
            tone: 'good',
            title: r.status === 'live' ? c().live : c().fixed,
            body: c().quoted(r.title),
          }
        : null,
      button(action),
    ]),
  }
}

const dailySummary: Composer = (d: TemplateData, action) => {
  const s = d.dailySummary
  const r = blockCopy2.reports
  return {
    eyebrow: r.dailyKicker,
    blocks: present([
      s
        ? {
            kind: 'stats',
            items: [
              { label: r.orders, value: String(s.orders) },
              { label: r.sales, value: s.salesLabel, tone: 'accent' },
              { label: r.toShip, value: String(s.toShip) },
            ],
          }
        : null,
      button(action),
    ]),
  }
}

export const teamComposers: Partial<Record<TemplateId, Composer>> = {
  staff_new_order: newOrder,
  contact_message: formMessage,
  question_asked: questionAsked,
  affiliate_application: affiliateApplication,
  unpaid_cancel_notice: unpaidNotice,
  purchase_order: purchaseOrder,
  staff_invite: invitation,
  plan_bill: planBill,
  bug_report_update: bugReport,
  staff_daily_summary: dailySummary,
}
