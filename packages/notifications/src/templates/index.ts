import { render } from '@react-email/render'
import { createElement } from 'react'
import { TransactionalEmail } from '../emails/transactional-email'
import type { TemplateData, TemplateId } from '../types'
import { sharedContent as shared, templateContent } from './content'

export type EmailBody = { subject: string; text: string; html: string }
export type WhatsappBody = { text: string }

export const TEMPLATE_IDS: TemplateId[] = [
  'order_placed',
  'payment_received',
  'order_shipped',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'order_cancelled',
  'refund_issued',
  'order_edited',
  'payment_pending',
  'shipping_update',
  'order_link',
  'order_split',
  'draft_invoice',
  'checkout_recovery',
  'document_copy',
  'customer_message',
  'login_code',
  'account_deletion_code',
  'login_link',
  'newsletter_confirm',
  'gift_card_issued',
  'balance_request',
  'balance_reminder',
  'balance_received',
  'payment_reminder',
  'transfer_requested',
  'unpaid_cancel_notice',
  'staff_new_order',
  'staff_daily_summary',
  'contact_message',
  'review_request',
  'review_reminder',
  'review_reply',
  'review_reward',
  'question_answered',
  'question_asked',
  'affiliate_update',
  'affiliate_application',
  'unpaid_cancelled',
  'back_in_stock_confirm',
  'back_in_stock_alert',
  'return_requested',
  'return_approved',
  'return_rejected',
  'return_received',
  'return_refunded',
  'return_exchanged',
  'cod_confirm',
  'staff_invite',
  'email_change_code',
  'email_changed',
  'plan_bill',
  'bug_report_update',
  'purchase_order',
]

/**
 * Templates the platform sends about itself (through the platform email account), never a store's
 * own customer messages. They are not in Settings → Notifications and a merchant cannot switch them off.
 */
export const PLATFORM_TEMPLATE_IDS: readonly TemplateId[] = [
  'staff_invite',
  'email_change_code',
  'email_changed',
  'plan_bill',
  'bug_report_update',
]

/** Human names for the dev preview list and the admin's document-template picker. */
export const TEMPLATE_NAMES: Record<TemplateId, string> = {
  order_placed: 'Order placed',
  payment_received: 'Payment received',
  order_shipped: 'Order shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  delivery_failed: 'Delivery attempt failed',
  order_cancelled: 'Order cancelled',
  refund_issued: 'Refund issued',
  order_edited: 'Order edited',
  payment_pending: 'Payment not finished',
  shipping_update: 'Shipping update',
  order_link: 'Order link',
  order_split: 'Order ships in parts',
  draft_invoice: 'Draft invoice',
  checkout_recovery: 'Checkout recovery',
  document_copy: 'Document copy',
  customer_message: 'Email from the customer page',
  login_code: 'Sign-in code',
  account_deletion_code: 'Account deletion code',
  login_link: 'Sign-in link',
  newsletter_confirm: 'Newsletter: confirm signup',
  gift_card_issued: 'Gift card issued',
  balance_request: 'Balance due',
  balance_reminder: 'Balance reminder',
  balance_received: 'Balance received',
  payment_reminder: 'Payment reminder',
  transfer_requested: 'Order received, complete your transfer',
  unpaid_cancel_notice: 'Unpaid order will be cancelled (merchant)',
  staff_new_order: 'New order (team member alert)',
  staff_daily_summary: 'Daily summary (team member alert)',
  contact_message: 'New form message (merchant)',
  review_request: 'Review request',
  review_reminder: 'Review reminder',
  review_reply: 'Reply to a review',
  review_reward: 'Photo review thanks',
  question_answered: 'Product question answered',
  question_asked: 'New product question (merchant)',
  affiliate_update: 'Affiliate update (to the affiliate)',
  affiliate_application: 'New affiliate application (merchant)',
  unpaid_cancelled: 'Unpaid order cancelled',
  back_in_stock_confirm: 'Back in stock: confirm alert',
  back_in_stock_alert: 'Back in stock: alert',
  return_requested: 'Return requested',
  return_approved: 'Return approved',
  return_rejected: 'Return declined',
  return_received: 'Return received',
  return_refunded: 'Return refunded',
  return_exchanged: 'Exchange on its way',
  cod_confirm: 'Confirm your cash on delivery order',
  staff_invite: 'Staff invitation (platform)',
  email_change_code: 'Change email: code (platform)',
  email_changed: 'Change email: notice to old address (platform)',
  plan_bill: 'Plan or app bill (platform)',
  bug_report_update: 'Bug report fixed or live (platform)',
  purchase_order: 'Purchase order (to supplier)',
}

/** Drop runs of blank lines left by optional sections. */
const squash = (lines: string[]): string =>
  lines.filter((l, i) => !(l === '' && lines[i - 1] === '')).join('\n')

function eyebrowFor(template: TemplateId, d: TemplateData): string {
  switch (template) {
    case 'login_code':
      return 'Sign-in code'
    case 'account_deletion_code':
      return 'Delete your account'
    case 'login_link':
      return 'Sign-in link'
    case 'newsletter_confirm':
      return 'Newsletter'
    case 'contact_message':
      return 'Form message'
    case 'review_request':
    case 'review_reminder':
    case 'review_reply':
    case 'review_reward':
      return 'Your review'
    case 'question_answered':
      return 'Your question'
    case 'question_asked':
      return 'Product question'
    case 'affiliate_update':
    case 'affiliate_application':
      return 'Affiliate program'
    case 'gift_card_issued':
      return 'Gift card'
    case 'staff_invite':
      return 'Team invitation'
    case 'plan_bill':
      return 'Your bill'
    case 'bug_report_update':
      return 'Your bug report'
    case 'staff_daily_summary':
      return 'Daily summary'
    case 'email_change_code':
    case 'email_changed':
      return 'Your sign-in email'
    case 'purchase_order':
      return `Purchase order ${d.purchaseOrder?.numberLabel ?? ''}`.trim()
    case 'checkout_recovery':
      return 'Your basket'
    case 'back_in_stock_confirm':
    case 'back_in_stock_alert':
      return 'Back in stock'
    case 'return_requested':
    case 'return_approved':
    case 'return_rejected':
    case 'return_received':
    case 'return_refunded':
    case 'return_exchanged':
      return d.returnInfo ? `Return ${d.returnInfo.label}` : `Order #${d.orderNumber}`
    default:
      if (d.draftNumber) return `Order #D${d.draftNumber}`
      return d.orderNumber ? `Order #${d.orderNumber}` : d.storeName
  }
}

function primaryActionFor(
  template: TemplateId,
  d: TemplateData,
): { label: string; url: string } | undefined {
  switch (template) {
    case 'order_placed':
    case 'payment_received':
      return d.orderUrl ? { label: shared.viewOrder, url: d.orderUrl } : undefined
    case 'order_shipped':
    case 'out_for_delivery':
      return d.trackingUrl
        ? { label: 'Track your order', url: d.trackingUrl }
        : d.orderUrl
          ? { label: shared.viewOrder, url: d.orderUrl }
          : undefined
    case 'delivered':
    case 'order_cancelled':
    case 'refund_issued':
      return d.orderUrl ? { label: shared.viewOrder, url: d.orderUrl } : undefined
    case 'delivery_failed':
      return d.trackingUrl
        ? { label: 'Track your order', url: d.trackingUrl }
        : d.orderUrl
          ? { label: shared.viewOrder, url: d.orderUrl }
          : undefined
    case 'shipping_update':
      return d.trackingUrl
        ? { label: 'Track your order', url: d.trackingUrl }
        : d.orderUrl
          ? { label: shared.viewOrder, url: d.orderUrl }
          : undefined
    case 'payment_pending':
      return d.orderUrl ? { label: 'Retry payment', url: d.orderUrl } : undefined
    case 'draft_invoice':
      return d.actionUrl ? { label: 'Pay securely', url: d.actionUrl } : undefined
    case 'checkout_recovery':
      return d.actionUrl ? { label: 'Finish checkout', url: d.actionUrl } : undefined
    case 'cod_confirm':
      return d.actionUrl ? { label: 'Confirm or cancel my order', url: d.actionUrl } : undefined
    case 'login_link':
      return d.actionUrl ? { label: `Sign in to ${d.storeName}`, url: d.actionUrl } : undefined
    case 'newsletter_confirm':
      return d.actionUrl ? { label: 'Confirm my email', url: d.actionUrl } : undefined
    case 'staff_invite':
      return d.actionUrl ? { label: 'Accept invitation', url: d.actionUrl } : undefined
    case 'plan_bill':
      return d.actionUrl ? { label: 'Pay now', url: d.actionUrl } : undefined
    case 'bug_report_update':
      return d.actionUrl ? { label: 'See my reports', url: d.actionUrl } : undefined
    case 'staff_new_order':
      return d.actionUrl ? { label: 'Open the order', url: d.actionUrl } : undefined
    case 'staff_daily_summary':
      return d.actionUrl ? { label: 'Open your admin', url: d.actionUrl } : undefined
    case 'document_copy':
      return d.links?.[0] ? { label: d.links[0].label, url: d.links[0].url } : undefined
    case 'balance_request':
    case 'balance_reminder':
      return d.actionUrl ? { label: 'Pay the balance', url: d.actionUrl } : undefined
    case 'payment_reminder':
    case 'transfer_requested':
      return d.orderUrl ? { label: 'View payment details', url: d.orderUrl } : undefined
    case 'back_in_stock_confirm':
      return d.backInStock?.confirmUrl
        ? { label: 'Confirm alert', url: d.backInStock.confirmUrl }
        : undefined
    case 'review_request':
    case 'review_reminder': {
      const first = d.review?.items?.[0]
      return first ? { label: 'Write a review', url: first.url } : undefined
    }
    case 'affiliate_update':
      return d.affiliate?.portalUrl
        ? { label: 'Open your dashboard', url: d.affiliate.portalUrl }
        : undefined
    case 'review_reply':
      return d.review?.productUrl ? { label: 'See the reply', url: d.review.productUrl } : undefined
    case 'review_reward':
      return d.actionUrl ? { label: 'Shop with your code', url: d.actionUrl } : undefined
    case 'question_answered':
      return d.review?.productUrl
        ? { label: 'See it on the product page', url: d.review.productUrl }
        : undefined
    case 'question_asked':
      return d.actionUrl ? { label: 'Answer the question', url: d.actionUrl } : undefined
    case 'back_in_stock_alert':
      return d.backInStock?.productUrl
        ? { label: 'Shop now', url: d.backInStock.productUrl }
        : undefined
    default:
      return d.orderUrl ? { label: shared.viewOrder, url: d.orderUrl } : undefined
  }
}

/** "Ships in 2 parcels" as plain text lines; nothing for an order shipping in one. */
function parcelsText(d: TemplateData): string[] {
  const parcels = d.parcels ?? []
  if (parcels.length < 2) return []
  const p = shared.parcels
  return [
    '',
    `${p.title(parcels.length)}:`,
    ...parcels.flatMap((parcel, i) => [
      `${p.parcel(i + 1, parcel.from)}${parcel.onHold ? ` (${p.onHold})` : parcel.dateRange ? ` (${p.arrives(parcel.dateRange)})` : ''}`,
      ...parcel.items.map((item) => `- ${p.item(item.quantity, item.title)}`),
    ]),
  ]
}

/** The same, as the email's parcels block. */
function parcelsBlock(d: TemplateData, template: TemplateId) {
  const parcels = d.parcels ?? []
  if (parcels.length < 2) return undefined
  const p = shared.parcels
  return {
    title: p.title(parcels.length),
    // A split to send the ready items first, not a second warehouse.
    note: template === 'order_split' ? p.splitNote : p.note,
    parcels: parcels.map((parcel, i) => ({
      heading: p.parcel(i + 1, parcel.from),
      items: parcel.items.map((item) => p.item(item.quantity, item.title)),
      when: parcel.onHold ? p.onHold : parcel.dateRange ? p.arrives(parcel.dateRange) : null,
    })),
  }
}

/** Team alerts and platform mail: a plainer email with no store menu or help block. */
const INTERNAL: ReadonlySet<TemplateId> = new Set<TemplateId>([
  'staff_new_order',
  'staff_daily_summary',
  'contact_message',
  'question_asked',
  'affiliate_application',
  'unpaid_cancel_notice',
  'purchase_order',
  ...PLATFORM_TEMPLATE_IDS,
])

const DELIVERY_STEP: Partial<Record<TemplateId, number>> = {
  order_placed: 0,
  payment_received: 0,
  order_shipped: 1,
  shipping_update: 1,
  out_for_delivery: 2,
  delivered: 3,
}

const RETURN_STEP: Partial<Record<TemplateId, number>> = {
  return_requested: 0,
  return_approved: 1,
  return_received: 2,
  return_refunded: 3,
}

function stepsFor(template: TemplateId) {
  const delivery = DELIVERY_STEP[template]
  if (delivery !== undefined) return { labels: [...shared.deliverySteps], current: delivery }
  const ret = RETURN_STEP[template]
  if (ret !== undefined) return { labels: [...shared.returnSteps], current: ret }
  return undefined
}

function metaFor(template: TemplateId, d: TemplateData): string[] {
  const meta: string[] = []
  if (d.waybill && DELIVERY_STEP[template] !== undefined)
    meta.push(shared.awb(d.courierLabel, d.waybill))
  if ((template === 'order_placed' || template === 'payment_received') && d.paymentMethodLabel) {
    meta.push(d.paymentMethodLabel)
  }
  return meta
}

/** "Store credit used ₹X · balance ₹Y" or "₹X added to your store credit · balance ₹Y". */
function storeCreditLine(d: TemplateData): string | undefined {
  const change = d.storeCredit?.change
  if (!change) return undefined
  const sc = shared.storeCredit
  return change.kind === 'used'
    ? sc.used(change.amountLabel, change.balanceLabel)
    : sc.added(change.amountLabel, change.balanceLabel)
}

/** The rows under a draft invoice's total when store credit pays part of it. */
function storeCreditRows(d: TemplateData): { label: string; amount: string }[] {
  const sc = d.storeCredit
  if (!sc?.appliedLabel || !sc.toPayLabel) return []
  return [
    { label: shared.storeCredit.applied, amount: sc.appliedLabel },
    { label: shared.storeCredit.toPay, amount: sc.toPayLabel },
  ]
}

export async function renderEmail(template: TemplateId, d: TemplateData): Promise<EmailBody> {
  const c = templateContent[template]
  const creditLine = storeCreditLine(d)
  const creditRows = storeCreditRows(d)
  const lines = d.lines.map(shared.lineText)
  // Messages about no order (a sign-in code) carry no items or total.
  const hasItems = d.lines.length > 0
  const gc = d.giftCard
  // The merchant's own note from the "Review email" dialog, under the intro.
  const note = d.custom?.message?.trim() || undefined

  const text = squash([
    c.heading(d),
    '',
    c.intro(d),
    ...(creditLine ? ['', creditLine] : []),
    ...(note ? ['', note] : []),
    '',
    ...(gc
      ? [
          `${shared.giftCardCode}: ${gc.code}`,
          `${shared.giftCardBalance}: ${gc.balanceLabel}`,
          gc.message ? `${shared.giftCardMessage}: ${gc.message}` : '',
        ]
      : hasItems
        ? [
            `${shared.itemsHeading}:`,
            ...lines.map((l) => `- ${l}`),
            ...(d.shipping ? [`${d.shipping.label}: ${d.shipping.amount}`] : []),
            `${shared.totalLabel}: ${d.totalLabel}`,
            ...creditRows.map((r) => `${r.label}: ${r.amount}`),
          ]
        : []),
    ...parcelsText(d),
    '',
    c.outro(d),
    d.orderUrl ? `${shared.viewOrder}: ${d.orderUrl}` : '',
    ...(d.links ?? []).map((l) => `${l.label}: ${l.url}`),
    '',
    shared.footer(d),
  ])

  const subject = d.custom?.subject?.trim() || c.subject(d)
  // Extra links go under the body as text lines (document links, installed-app links);
  // the primary action already carries the main call to action as a button.
  const primaryAction = primaryActionFor(template, d)
  const extraLinks = (d.links ?? []).filter((l) => l.url !== primaryAction?.url)

  const html = await render(
    createElement(TransactionalEmail, {
      storeName: d.storeName,
      storeAddress: d.storeAddress,
      brand: d.brand,
      previewText: subject,
      eyebrow: eyebrowFor(template, d),
      // A six-digit code reads as two groups ("482 913"); the text part keeps it whole for copying.
      code: d.code
        ? { label: shared.codeLabel, value: d.code.replace(/^(\d{3})(\d{3})$/, '$1 $2') }
        : undefined,
      steps: stepsFor(template),
      heading: c.heading(d),
      intro: c.intro(d),
      notice: creditLine,
      note,
      outro: c.outro(d),
      lines: gc ? [] : d.lines,
      itemsTitle: shared.itemsTitle,
      totalHeading: shared.totalLabel,
      qty: shared.qty,
      totalLabel: gc ? undefined : d.totalLabel,
      shipping: gc ? undefined : d.shipping,
      taxBreakdown: gc ? undefined : d.taxBreakdown,
      afterTotal: gc ? undefined : creditRows,
      parcels: gc ? undefined : parcelsBlock(d, template),
      giftCard: gc
        ? {
            label: shared.giftCardLabel,
            code: gc.code,
            lines: [`${shared.giftCardBalance}: ${gc.balanceLabel}`, gc.message],
          }
        : undefined,
      primaryAction,
      meta: metaFor(template, d),
      extraLinks,
      internal: INTERNAL.has(template),
      labels: shared.layout,
      footerNote: shared.footer(d),
    }),
  )

  return { subject, text, html }
}

export function renderWhatsapp(template: TemplateId, d: TemplateData): WhatsappBody {
  const text = templateContent[template].whatsapp(d)
  const note = d.custom?.message?.trim()
  return { text: note ? `${note}\n\n${text}` : text }
}
