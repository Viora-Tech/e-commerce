import { render } from '@react-email/render'
import { createElement } from 'react'
import { designFor } from '../design/design-for'
import { DesignedEmail } from '../design/designed-email'
import { designTextLines, introOverride } from '../design/plain-text'
import { fillVariables } from '../design/variables'
import { PerformanceReportEmail } from '../emails/performance-report'
import { TransactionalEmail } from '../emails/transactional-email'
import type { TemplateData, TemplateId } from '../types'
import { composeEmail } from './compose'
import { sharedContent as shared, templateContent } from './content'
import { footerReason } from './content-footer'
import { reportPlainText, reportWords } from './content-reports'
import { INTERNAL, PLATFORM_TEMPLATE_IDS, REPORTS } from './internal'
import { primaryActionFor } from './primary-action'

export { PLATFORM_TEMPLATE_IDS }

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
  'cod_pay_online',
  'draft_invoice',
  'checkout_recovery',
  'document_copy',
  'customer_message',
  'login_code',
  'account_deletion_code',
  'login_link',
  'newsletter_confirm',
  'gift_card_issued',
  'welcome_coupon',
  'balance_request',
  'balance_reminder',
  'balance_received',
  'payment_reminder',
  'transfer_requested',
  'unpaid_cancel_notice',
  'staff_new_order',
  'staff_daily_summary',
  'staff_weekly_report',
  'staff_monthly_report',
  'staff_seo_weekly',
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
  cod_pay_online: 'Pay online instead of cash on delivery',
  draft_invoice: 'Draft invoice',
  checkout_recovery: 'Checkout recovery',
  document_copy: 'Document copy',
  customer_message: 'Email from the customer page',
  login_code: 'Sign-in code',
  account_deletion_code: 'Account deletion code',
  login_link: 'Sign-in link',
  newsletter_confirm: 'Newsletter: confirm signup',
  gift_card_issued: 'Gift card issued',
  welcome_coupon: 'Welcome coupon',
  balance_request: 'Balance due',
  balance_reminder: 'Balance reminder',
  balance_received: 'Balance received',
  payment_reminder: 'Payment reminder',
  transfer_requested: 'Order received, complete your transfer',
  unpaid_cancel_notice: 'Unpaid order will be cancelled (merchant)',
  staff_new_order: 'New order (team member alert)',
  staff_daily_summary: 'Daily summary (team member alert)',
  staff_weekly_report: 'Weekly report (team member alert)',
  staff_monthly_report: 'Monthly report (team member alert)',
  staff_seo_weekly: 'Weekly SEO email (store owner)',
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
    case 'staff_weekly_report':
      return 'Weekly report'
    case 'staff_monthly_report':
      return 'Monthly report'
    case 'staff_seo_weekly':
      return 'Weekly SEO'
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
  if (d.report && REPORTS.has(template)) {
    const subject = d.custom?.subject?.trim() || templateContent[template].subject(d)
    const html = await render(
      createElement(PerformanceReportEmail, {
        storeName: d.storeName,
        brand: d.brand,
        previewText: subject,
        report: d.report,
        words: reportWords,
      }),
    )
    return { subject, text: squash(reportPlainText(d).split('\n')), html }
  }
  const c = templateContent[template]
  const creditLine = storeCreditLine(d)
  const creditRows = storeCreditRows(d)
  const lines = d.lines.map(shared.lineText)
  // Messages about no order (a sign-in code) carry no items or total.
  const hasItems = d.lines.length > 0
  const gc = d.giftCard
  // The merchant's own note from the "Review email" dialog, under the intro.
  const note = d.custom?.message?.trim() || undefined

  // A merchant's saved design (Edit design); null keeps the built-in email.
  const design = designFor(template, d)
  const override = design ? introOverride(design.blocks, d) : {}

  const text = squash([
    override.heading ?? c.heading(d),
    '',
    override.lead ?? c.intro(d),
    ...(creditLine ? ['', creditLine] : []),
    ...(note ? ['', note] : []),
    ...(design ? designTextLines(design.blocks, d) : []),
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

  const subject =
    d.custom?.subject?.trim() ||
    (design?.subject ? fillVariables(design.subject, d).trim() : '') ||
    c.subject(d)
  // Extra links go under the body as text lines (document links, installed-app links);
  // the primary action already carries the main call to action as a button.
  const primaryAction = primaryActionFor(template, d)
  // Messages already built from the shared blocks (emails/blocks), batch by batch.
  const composed = composeEmail(template, d, primaryAction)
  // A link a block already shows as a file (the invoice's Download) is not listed again.
  const shown = new Set(
    composed?.blocks.flatMap((b) => (b.kind === 'attachment' && b.link ? [b.link.url] : [])),
  )
  const extraLinks = (d.links ?? []).filter(
    (l) => l.url !== primaryAction?.url && !shown.has(l.url),
  )

  if (design) {
    try {
      const html = await render(
        createElement(DesignedEmail, {
          data: d,
          brand: d.brand,
          storeAddress: d.storeAddress,
          footerNote: footerReason(template, d),
          labels: shared.layout,
          previewText: subject,
          eyebrow: composed?.eyebrow ?? eyebrowFor(template, d),
          heading: composed?.heading ?? c.heading(d),
          lead: composed?.lead ?? c.intro(d),
          paragraphs: [
            creditLine,
            ...((composed?.ownsNote ? undefined : note)?.split(/\n+/).filter(Boolean) ?? []),
          ].filter((t): t is string => Boolean(t)),
          blocks: design.blocks,
          internal: INTERNAL.has(template),
        }),
      )
      return { subject, text, html }
    } catch (err) {
      // An order email never fails over a design: send the built-in one instead.
      console.warn('email design failed to render; sending the built-in email', {
        template,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const html = await render(
    createElement(TransactionalEmail, {
      storeName: d.storeName,
      storeAddress: d.storeAddress,
      brand: d.brand,
      previewText: subject,
      eyebrow: composed?.eyebrow ?? eyebrowFor(template, d),
      // Links an app adds (a document, a review form) go under the blocks, one per line.
      blocks: composed
        ? [
            ...composed.blocks,
            ...(extraLinks.length > 0 ? [{ kind: 'links' as const, items: extraLinks }] : []),
          ]
        : undefined,
      // A six-digit code reads as two groups ("482 913"); the text part keeps it whole for copying.
      code: d.code
        ? { label: shared.codeLabel, value: d.code.replace(/^(\d{3})(\d{3})$/, '$1 $2') }
        : undefined,
      steps: stepsFor(template),
      heading: composed?.heading ?? c.heading(d),
      intro: composed?.lead ?? c.intro(d),
      notice: creditLine,
      note: composed?.ownsNote ? undefined : note,
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
      // Why this address got it (Figma footer); the plain text keeps the reply line.
      footerNote: footerReason(template, d),
    }),
  )

  return { subject, text, html }
}

export function renderWhatsapp(template: TemplateId, d: TemplateData): WhatsappBody {
  const text = templateContent[template].whatsapp(d)
  const note = d.custom?.message?.trim()
  return { text: note ? `${note}\n\n${text}` : text }
}
