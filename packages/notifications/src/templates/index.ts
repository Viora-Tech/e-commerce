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
  'unpaid_cancel_notice',
  'staff_new_order',
  'staff_daily_summary',
  'contact_message',
  'review_request',
  'review_reminder',
  'review_reply',
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
  unpaid_cancel_notice: 'Unpaid order will be cancelled (merchant)',
  staff_new_order: 'New order (team member alert)',
  staff_daily_summary: 'Daily summary (team member alert)',
  contact_message: 'New form message (merchant)',
  review_request: 'Review request',
  review_reminder: 'Review reminder',
  review_reply: 'Reply to a review',
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
      return 'Your review'
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
function parcelsBlock(d: TemplateData) {
  const parcels = d.parcels ?? []
  if (parcels.length < 2) return undefined
  const p = shared.parcels
  return {
    title: p.title(parcels.length),
    note: p.note,
    parcels: parcels.map((parcel, i) => ({
      heading: p.parcel(i + 1, parcel.from),
      items: parcel.items.map((item) => p.item(item.quantity, item.title)),
      when: parcel.onHold ? p.onHold : parcel.dateRange ? p.arrives(parcel.dateRange) : null,
    })),
  }
}

export async function renderEmail(template: TemplateId, d: TemplateData): Promise<EmailBody> {
  const c = templateContent[template]
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
      previewText: subject,
      eyebrow: eyebrowFor(template, d),
      heading: c.heading(d),
      intro: c.intro(d),
      note,
      outro: c.outro(d),
      lines: gc ? [] : d.lines,
      totalLabel: gc ? undefined : d.totalLabel,
      shipping: gc ? undefined : d.shipping,
      taxBreakdown: gc ? undefined : d.taxBreakdown,
      parcels: gc ? undefined : parcelsBlock(d),
      giftCard: gc,
      code: d.code,
      primaryAction,
      extraLinks,
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
