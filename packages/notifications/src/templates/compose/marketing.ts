import type { EmailBlock } from '../../emails/blocks'
import type { TemplateData, TemplateId } from '../../types'
import { sharedContent as shared, templateContent } from '../content'
import { blockCopy2 } from '../content-blocks-2'
import type { Composer } from './index'
import { button, firstParagraph, itemCount, muted, orderItems, present } from './order'

/**
 * Batch 8, marketing and reviews: a basket, a product, a code or someone's words in a quote
 * box, then the one button. Every message keeps its unsubscribe or stop link in the footer.
 */
const c = () => blockCopy2.marketing

/** The back-in-stock product: its name, the variant, and a badge once it is in stock. */
function stockProduct(d: TemplateData, badge?: string): EmailBlock | null {
  const b = d.backInStock
  if (!b) return null
  return {
    kind: 'product',
    title: b.productTitle,
    note: b.variantTitle,
    url: b.productUrl,
    badge,
  }
}

const basket: Composer = (d, action) => ({
  eyebrow: c().basketKicker,
  lead: d.lines.length > 0 ? c().basketLead(itemCount(d), d.totalLabel) : undefined,
  blocks: present([orderItems(d, { title: c().yourBasket, totals: false }), button(action)]),
})

const stockConfirm: Composer = (d, action) => ({
  eyebrow: c().stockKicker,
  lead: c().stockLead,
  blocks: present([stockProduct(d), button(action, c().alertMe), muted(c().stockIgnore)]),
})

const stockAlert: Composer = (d, action) => ({
  eyebrow: c().backKicker,
  lead: d.backInStock ? c().backLead(d.backInStock.productTitle) : undefined,
  blocks: present([stockProduct(d, c().inStock), button(action), muted(c().sellOut)]),
})

/** Each product to review as its own row, the whole row a link to its review form. */
function reviewRows(d: TemplateData, max: number): EmailBlock[] {
  return (d.review?.items ?? []).slice(0, max).map((i) => ({
    kind: 'product',
    title: i.title,
    note: c().tapToRate,
    imageUrl: i.imageUrl,
    url: i.url,
  }))
}

const reviewRequest: Composer = (d, action) => ({
  eyebrow: c().reviewKicker(d.orderNumber),
  lead: c().reviewLead,
  blocks: present([...reviewRows(d, 6), button(action)]),
})

const reviewReminder: Composer = (d, action) => ({
  eyebrow: c().reminderKicker(d.orderNumber),
  blocks: present([...reviewRows(d, 1), button(action)]),
})

const reviewReply: Composer = (d, action) => ({
  eyebrow: c().replyKicker,
  lead: c().replyLead(d.review?.productTitle),
  blocks: present([
    d.review?.reply
      ? { kind: 'quote', label: c().replied(d.storeName), text: d.review.reply, tone: 'accent' }
      : null,
    button(action),
  ]),
})

const reviewReward: Composer = (d, action) => {
  const r = d.review
  return {
    eyebrow: c().replyKicker,
    lead: c().rewardLead,
    blocks: present([
      r?.rewardCode
        ? {
            kind: 'coupon',
            label: c().yourCode,
            code: r.rewardCode,
            note: c().rewardNote(r.rewardUntil),
            value: r.rewardLabel,
          }
        : null,
      button(action),
    ]),
  }
}

const questionAnswered: Composer = (d, action) => {
  const r = d.review
  return {
    eyebrow: c().questionKicker,
    lead: c().questionLead(r?.productTitle) || undefined,
    blocks: present([
      r?.question ? { kind: 'quote', label: c().youAsked, text: r.question } : null,
      r?.answer
        ? { kind: 'quote', label: c().answered(d.storeName), text: r.answer, tone: 'accent' }
        : null,
      button(action),
    ]),
  }
}

const storeMessage: Composer = (d) => {
  const note = d.custom?.message?.trim()
  return {
    eyebrow: c().messageKicker(d.storeName),
    ownsNote: true,
    blocks: present([
      note ? { kind: 'quote', label: c().messageFrom(d.storeName), text: note } : null,
      d.orderUrl ? { kind: 'button', label: shared.viewOrder, url: d.orderUrl } : null,
    ]),
  }
}

/** What the affiliate news carries: the link and code, the commission, the payout or the note. */
function affiliateBlock(d: TemplateData): EmailBlock | null {
  const a = d.affiliate
  if (!a) return null
  if (a.kind === 'approved') {
    const rows = [
      ...(a.link ? [{ label: c().yourLink, value: a.link }] : []),
      ...(a.couponCode ? [{ label: c().yourCodeLabel, value: a.couponCode }] : []),
    ]
    return rows.length > 0 ? { kind: 'facts', rows } : null
  }
  if (a.kind === 'sale') {
    return a.amountLabel
      ? { kind: 'stats', items: [{ label: c().youEarn, value: a.amountLabel, tone: 'accent' }] }
      : null
  }
  if (a.kind === 'payout') {
    return {
      kind: 'facts',
      rows: [
        ...(a.amountLabel ? [{ label: c().paid, value: a.amountLabel, strong: true }] : []),
        ...(a.tdsLabel ? [{ label: c().tds, value: a.tdsLabel }] : []),
        ...(a.reference ? [{ label: c().reference, value: a.reference }] : []),
      ],
    }
  }
  if (a.kind === 'rejected' && a.reason) {
    return { kind: 'notice', tone: 'neutral', title: c().theirNote, body: a.reason }
  }
  return null
}

const affiliate: Composer = (d, action) => ({
  eyebrow: c().affiliateKicker,
  // The intro's first paragraph; the link, code and payout figures sit in the block below.
  lead: firstParagraph(templateContent.affiliate_update.intro(d)),
  blocks: present([affiliateBlock(d), button(action)]),
})

export const marketingComposers: Partial<Record<TemplateId, Composer>> = {
  checkout_recovery: basket,
  back_in_stock_confirm: stockConfirm,
  back_in_stock_alert: stockAlert,
  review_request: reviewRequest,
  review_reminder: reviewReminder,
  review_reply: reviewReply,
  review_reward: reviewReward,
  question_answered: questionAnswered,
  customer_message: storeMessage,
  affiliate_update: affiliate,
}
