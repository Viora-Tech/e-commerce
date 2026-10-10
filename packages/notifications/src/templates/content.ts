import { siteConfig } from '@commerce/config/site'
import type { TemplateData, TemplateId } from '../types'

/**
 * Every word a shopper receives. Change copy here, never inside a renderer.
 * `subject`/`heading`/`intro`/`outro` feed email; `whatsapp` is the short form.
 */
type TemplateCopy = {
  subject: (d: TemplateData) => string
  heading: (d: TemplateData) => string
  intro: (d: TemplateData) => string
  outro: (d: TemplateData) => string
  whatsapp: (d: TemplateData) => string
}

const payBy = (d: TemplateData): string =>
  d.balance?.payByLabel ? ` Please pay by ${d.balance.payByLabel}.` : ''
const keepNote = (d: TemplateData): string =>
  d.balance?.depositNonRefundable
    ? ' If it is not paid in time the order is cancelled and the deposit is not refunded.'
    : ''

export const balanceTemplates = {
  balance_request: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} is almost ready, balance due`,
    heading: (d) => `Hi ${d.customerName}, your pre-order is nearly here`,
    intro: (d) =>
      `You paid ${d.balance?.depositLabel ?? ''} up front for order #${d.orderNumber}. The balance of ${d.balance?.dueLabel ?? ''} is now due.${payBy(d)}${keepNote(d)}`,
    outro: (d) =>
      d.actionUrl ? `Pay the balance here: ${d.actionUrl}` : 'Reply to this email to pay.',
    whatsapp: (d) =>
      `${d.storeName}: balance of ${d.balance?.dueLabel ?? ''} is due for pre-order #${d.orderNumber}.${payBy(d)}${d.actionUrl ? ` Pay: ${d.actionUrl}` : ''}`,
  },
  balance_reminder: {
    subject: (d) => `${d.storeName}: reminder, balance due for order #${d.orderNumber}`,
    heading: (d) => `Hi ${d.customerName}, a quick reminder`,
    intro: (d) =>
      `The balance of ${d.balance?.dueLabel ?? ''} for pre-order #${d.orderNumber} is still due.${payBy(d)}${keepNote(d)}`,
    outro: (d) =>
      d.actionUrl ? `Pay the balance here: ${d.actionUrl}` : 'Reply to this email to pay.',
    whatsapp: (d) =>
      `Reminder from ${d.storeName}: ${d.balance?.dueLabel ?? ''} is still due for pre-order #${d.orderNumber}.${payBy(d)}${d.actionUrl ? ` Pay: ${d.actionUrl}` : ''}`,
  },
  balance_received: {
    subject: (d) => `${d.storeName}: balance for order #${d.orderNumber} received`,
    heading: () => 'Balance received',
    intro: (d) => `Order #${d.orderNumber} is now paid in full (${d.totalLabel}).`,
    outro: () => 'We will message you again as soon as it ships.',
    whatsapp: (d) =>
      `${d.storeName}: balance received, pre-order #${d.orderNumber} is paid in full. We will update you when it ships.`,
  },
} satisfies Record<'balance_request' | 'balance_reminder' | 'balance_received', TemplateCopy>

export const transferTemplates = {
  payment_reminder: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} is waiting for payment`,
    heading: (d) => `Hi ${d.customerName}, your order is on hold`,
    intro: (d) =>
      `We have not received the ${d.totalLabel} UPI or bank transfer for order #${d.orderNumber} yet. We are holding your items until then.`,
    outro: (d) =>
      d.orderUrl
        ? `The QR code and payment details are here: ${d.orderUrl}`
        : 'Reply to this email if you have already paid.',
    whatsapp: (d) =>
      `${d.storeName}: order #${d.orderNumber} is waiting for your ${d.totalLabel} payment.${d.orderUrl ? ` Pay: ${d.orderUrl}` : ''}`,
  },
  unpaid_cancel_notice: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} will be cancelled for non-payment`,
    heading: () => 'An unpaid transfer order is about to be cancelled',
    intro: (d) =>
      `Order #${d.orderNumber} (${d.totalLabel}, UPI or bank transfer) is still unpaid and will be cancelled automatically${d.deadlineLabel ? ` on ${d.deadlineLabel}` : ''}, releasing its stock.`,
    outro: () =>
      'If the money has arrived, mark the order as paid in your admin before then. The customer has not been told.',
    whatsapp: (d) =>
      `${d.storeName}: unpaid order #${d.orderNumber} (${d.totalLabel}) will be cancelled${d.deadlineLabel ? ` on ${d.deadlineLabel}` : ''}. Mark it paid if the transfer arrived.`,
  },
  unpaid_cancelled: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} was cancelled`,
    heading: (d) => `Hi ${d.customerName}, we cancelled your order`,
    intro: (d) =>
      `We did not receive the ${d.totalLabel} payment for order #${d.orderNumber}, so it has been cancelled and the items released.`,
    outro: () => 'If you have paid, reply to this email and we will sort it out.',
    whatsapp: (d) =>
      `${d.storeName}: order #${d.orderNumber} was cancelled because the ${d.totalLabel} payment did not arrive. Paid already? Just reply.`,
  },
} satisfies Record<'payment_reminder' | 'unpaid_cancel_notice' | 'unpaid_cancelled', TemplateCopy>

export const backInStockTemplates = {
  back_in_stock_confirm: {
    subject: (d) => `Confirm: notify me when ${d.backInStock?.productTitle ?? 'this item'} is back`,
    heading: () => 'Confirm your alert',
    intro: (d) =>
      `Almost done — confirm you want an email when ${[
        d.backInStock?.productTitle,
        d.backInStock?.variantTitle,
      ]
        .filter(Boolean)
        .join(' / ')} is back in stock.`,
    outro: (d) =>
      d.backInStock?.confirmUrl
        ? `Confirm here: ${d.backInStock.confirmUrl}`
        : 'Confirm from your inbox.',
    whatsapp: (d) =>
      `Confirm your back-in-stock alert for ${d.backInStock?.productTitle ?? 'this item'}.${
        d.backInStock?.confirmUrl ? ` Confirm: ${d.backInStock.confirmUrl}` : ''
      }`,
  },
  back_in_stock_alert: {
    subject: (d) => `${d.backInStock?.productTitle ?? 'Good news'} is back in stock`,
    heading: () => "It's back!",
    intro: (d) =>
      `${[d.backInStock?.productTitle, d.backInStock?.variantTitle].filter(Boolean).join(' / ')} is available again at ${d.storeName}.`,
    outro: (d) =>
      d.backInStock?.productUrl
        ? `Get it before it sells out: ${d.backInStock.productUrl}`
        : 'Get it before it sells out.',
    whatsapp: (d) =>
      `${d.backInStock?.productTitle ?? 'Good news'} is back in stock at ${d.storeName}.${
        d.backInStock?.productUrl ? ` Shop: ${d.backInStock.productUrl}` : ''
      }`,
  },
} satisfies Record<'back_in_stock_confirm' | 'back_in_stock_alert', TemplateCopy>

const ret = (d: TemplateData): string => d.returnInfo?.label ?? ''
const refundWhere = (d: TemplateData): string =>
  d.returnInfo?.refundMethod === 'store_credit'
    ? 'as store credit. The gift card code is in a separate email, and you can use it at checkout'
    : 'to the way you paid. Banks usually show it in 5 to 7 working days'
const howBack = (d: TemplateData): string =>
  d.returnInfo?.pickup === 'courier'
    ? `A courier will come to collect it${d.returnInfo.pickupWaybill ? ` (tracking number ${d.returnInfo.pickupWaybill})` : ''}. Please pack the items safely and keep them ready.`
    : 'Please pack the items safely and send them back to us. Reply to this email if you need our address.'

const returnTemplates = {
  return_requested: {
    subject: (d) => `${d.storeName}: we got your return request for order #${d.orderNumber}`,
    heading: (d) => `Thanks, ${d.customerName}. We got your request`,
    intro: (d) =>
      `Your return ${ret(d)} for order #${d.orderNumber} is with us${d.returnInfo?.reasonLabel ? ` (${d.returnInfo.reasonLabel.toLowerCase()})` : ''}. We usually reply within 2 working days.`,
    outro: () => 'You can see where it stands on your order page at any time.',
    whatsapp: (d) =>
      `${d.storeName}: we got your return request ${ret(d)} for order #${d.orderNumber}. We will reply within 2 working days.`,
  },
  return_approved: {
    subject: (d) => `${d.storeName}: your return ${ret(d)} is approved`,
    heading: () => 'Your return is approved',
    intro: (d) => `Good news: we accepted return ${ret(d)} for order #${d.orderNumber}.`,
    outro: (d) => howBack(d),
    whatsapp: (d) =>
      `${d.storeName}: return ${ret(d)} for order #${d.orderNumber} is approved. ${howBack(d)}`,
  },
  return_rejected: {
    subject: (d) => `${d.storeName}: about your return request for order #${d.orderNumber}`,
    heading: (d) => `Hi ${d.customerName}, we could not accept this return`,
    intro: (d) =>
      `We are sorry, return ${ret(d)} for order #${d.orderNumber} was not accepted.${d.returnInfo?.decisionNote ? ` Reason: ${d.returnInfo.decisionNote}` : ''}`,
    outro: () => 'If you think this is a mistake, just reply to this email and we will look again.',
    whatsapp: (d) =>
      `${d.storeName}: return ${ret(d)} for order #${d.orderNumber} was not accepted.${d.returnInfo?.decisionNote ? ` Reason: ${d.returnInfo.decisionNote}` : ''} Reply if you have questions.`,
  },
  return_received: {
    subject: (d) => `${d.storeName}: we received your return ${ret(d)}`,
    heading: () => 'We received your return',
    intro: (d) => `The items from return ${ret(d)} (order #${d.orderNumber}) reached us.`,
    outro: () =>
      'We are checking them now and will message you once your refund or exchange is on its way.',
    whatsapp: (d) =>
      `${d.storeName}: we received return ${ret(d)} for order #${d.orderNumber}. We will update you once it is processed.`,
  },
  return_refunded: {
    subject: (d) => `${d.storeName}: refund for return ${ret(d)} is on its way`,
    heading: () => 'Your refund is on its way',
    intro: (d) =>
      `We sent ${d.returnInfo?.refundLabel ?? d.totalLabel} for return ${ret(d)} (order #${d.orderNumber}) ${refundWhere(d)}.`,
    outro: () => 'Thank you for shopping with us.',
    whatsapp: (d) =>
      `${d.storeName}: refund of ${d.returnInfo?.refundLabel ?? d.totalLabel} for return ${ret(d)} is on its way ${d.returnInfo?.refundMethod === 'store_credit' ? 'as store credit' : 'to the way you paid'}.`,
  },
} satisfies Record<
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected'
  | 'return_received'
  | 'return_refunded',
  TemplateCopy
>

/** Shipment status and order lifecycle messages not already covered above. */
const shipmentTemplates = {
  out_for_delivery: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} is out for delivery`,
    heading: () => "It's out for delivery",
    intro: (d) =>
      `Order #${d.orderNumber} is with the courier for delivery today.${d.waybill ? ` Tracking number: ${d.waybill}.` : ''}`,
    outro: (d) => (d.trackingUrl ? `Track it here: ${d.trackingUrl}` : 'It should arrive today.'),
    whatsapp: (d) =>
      `${d.storeName} order #${d.orderNumber} is out for delivery today.${d.trackingUrl ? ` Track: ${d.trackingUrl}` : ''}`,
  },
  delivered: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} was delivered`,
    heading: () => 'Delivered',
    intro: (d) => `Order #${d.orderNumber} has been delivered. We hope you love it.`,
    outro: () => 'Something wrong with it? Just reply to this email.',
    whatsapp: (d) => `${d.storeName} order #${d.orderNumber} was delivered. Enjoy!`,
  },
  delivery_failed: {
    subject: (d) => `${d.storeName}: a delivery attempt for order #${d.orderNumber} failed`,
    heading: () => 'We could not deliver your order',
    intro: (d) =>
      `The courier tried to deliver order #${d.orderNumber} but could not.${
        d.deliveryIssue?.reasonLabel ? ` Reason given: ${d.deliveryIssue.reasonLabel}.` : ''
      }`,
    outro: (d) =>
      d.trackingUrl
        ? `Check the tracking page and reply to this email with the best time and address to try again: ${d.trackingUrl}`
        : 'Reply to this email with the best time and address to try again, and we will arrange another attempt.',
    whatsapp: (d) =>
      `${d.storeName}: delivery of order #${d.orderNumber} failed.${
        d.deliveryIssue?.reasonLabel ? ` Reason: ${d.deliveryIssue.reasonLabel}.` : ''
      } Reply here to arrange another attempt.`,
  },
  order_cancelled: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} was cancelled`,
    heading: (d) => `Hi ${d.customerName}, your order was cancelled`,
    intro: (d) => `Order #${d.orderNumber} (${d.totalLabel}) has been cancelled.`,
    outro: () => 'Anything already paid will be refunded separately if it has not been already.',
    whatsapp: (d) =>
      `${d.storeName}: your order #${d.orderNumber} (${d.totalLabel}) was cancelled.`,
  },
  refund_issued: {
    subject: (d) => `${d.storeName}: a refund for order #${d.orderNumber} was issued`,
    heading: () => 'Refund issued',
    intro: (d) =>
      `We have refunded ${d.refund?.amountLabel ?? ''} for order #${d.orderNumber} to ${
        d.refund?.methodLabel ?? 'your payment method'
      }.${d.refund?.etaLabel ? ` It should reach you in ${d.refund.etaLabel}.` : ''}`,
    outro: () => 'Reply to this email if you have any questions about this refund.',
    whatsapp: (d) =>
      `${d.storeName}: ${d.refund?.amountLabel ?? ''} refunded for order #${d.orderNumber} to ${
        d.refund?.methodLabel ?? 'your payment method'
      }.${d.refund?.etaLabel ? ` Expect it in ${d.refund.etaLabel}.` : ''}`,
  },
} satisfies Record<
  'out_for_delivery' | 'delivered' | 'delivery_failed' | 'order_cancelled' | 'refund_issued',
  TemplateCopy
>

const platformName = (d: TemplateData): string =>
  d.staffInvite?.platformName || siteConfig.brand.name
const asRole = (d: TemplateData): string =>
  d.staffInvite?.roleLabel ? ` as ${d.staffInvite.roleLabel}` : ''
const invitedBy = (d: TemplateData): string => d.staffInvite?.inviterEmail || 'The store owner'

/** Messages the platform sends about itself, through its own email account. */
const platformTemplates = {
  staff_invite: {
    subject: (d) => `You're invited to manage ${d.storeName} on ${platformName(d)}`,
    heading: (d) => `Join ${d.storeName} on ${platformName(d)}`,
    intro: (d) =>
      `${invitedBy(d)} invited you to help run ${d.storeName}${asRole(d)}. Accept the invitation and sign in with this email address to get started.`,
    outro: (d) =>
      `${d.actionUrl ? `Accept here: ${d.actionUrl}. ` : ''}The invitation expires in 2 days. If you were not expecting it, ignore this email.`,
    whatsapp: (d) =>
      `${invitedBy(d)} invited you to help run ${d.storeName} on ${platformName(d)}.${d.actionUrl ? ` Accept: ${d.actionUrl}` : ''}`,
  },
} satisfies Record<'staff_invite', TemplateCopy>

const poLabel = (d: TemplateData): string => d.purchaseOrder?.numberLabel ?? ''
const poExpected = (d: TemplateData): string =>
  d.purchaseOrder?.expectedLabel
    ? ` We expect it to arrive by ${d.purchaseOrder.expectedLabel}.`
    : ''

/** Messages a store sends to its suppliers, not its shoppers. */
const supplierTemplates = {
  purchase_order: {
    subject: (d) => `${d.storeName}: purchase order ${poLabel(d)}`,
    heading: (d) => `Hello ${d.purchaseOrder?.supplierName || 'there'}`,
    intro: (d) =>
      `Please find purchase order ${poLabel(d)} from ${d.storeName} attached (${d.totalLabel}).${poExpected(d)}`,
    outro: (d) =>
      `${d.purchaseOrder?.message ? `${d.purchaseOrder.message} ` : ''}Please confirm the order and the dispatch date by replying to this email.`,
    whatsapp: (d) => `${d.storeName}: purchase order ${poLabel(d)} (${d.totalLabel}).`,
  },
} satisfies Record<'purchase_order', TemplateCopy>

export const templateContent: Record<TemplateId, TemplateCopy> = {
  ...platformTemplates,
  ...supplierTemplates,
  ...balanceTemplates,
  ...transferTemplates,
  ...backInStockTemplates,
  ...returnTemplates,
  ...shipmentTemplates,
  order_placed: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} received`,
    heading: (d) => `Thanks, ${d.customerName}`,
    intro: (d) =>
      `We have your order #${d.orderNumber} for ${d.totalLabel} (${d.paymentMethodLabel}).`,
    outro: () => 'We will message you again as soon as it ships.',
    whatsapp: (d) =>
      `Hi ${d.customerName}, ${d.storeName} has received order #${d.orderNumber} for ${d.totalLabel}. We will update you when it ships.`,
  },
  payment_received: {
    subject: (d) => `${d.storeName}: payment for order #${d.orderNumber} received`,
    heading: () => 'Payment received',
    intro: (d) => `Your payment of ${d.totalLabel} for order #${d.orderNumber} has been confirmed.`,
    outro: () => 'Your order is now being packed.',
    whatsapp: (d) =>
      `Payment of ${d.totalLabel} for ${d.storeName} order #${d.orderNumber} received. We are packing it now.`,
  },
  order_shipped: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} is on its way`,
    heading: () => 'Your order has shipped',
    intro: (d) =>
      `Order #${d.orderNumber} has left our warehouse.${d.waybill ? ` Tracking number: ${d.waybill}.` : ''}`,
    outro: (d) =>
      d.trackingUrl ? `Track it here: ${d.trackingUrl}` : 'Tracking details follow shortly.',
    whatsapp: (d) =>
      `${d.storeName} order #${d.orderNumber} has shipped.${d.waybill ? ` AWB ${d.waybill}.` : ''}${d.trackingUrl ? ` Track: ${d.trackingUrl}` : ''}`,
  },
  draft_invoice: {
    subject: (d) => `${d.storeName}: your order #${d.orderNumber} is ready to pay`,
    heading: (d) => `Hi ${d.customerName}`,
    intro: (d) => `We have prepared order #${d.orderNumber} for ${d.totalLabel}.`,
    outro: (d) => (d.actionUrl ? `Pay securely here: ${d.actionUrl}` : 'Reply to confirm.'),
    whatsapp: (d) =>
      `${d.storeName}: order #${d.orderNumber} for ${d.totalLabel} is ready.${d.actionUrl ? ` Pay: ${d.actionUrl}` : ''}`,
  },
  checkout_recovery: {
    subject: (d) => `${d.storeName}: you left something behind`,
    heading: (d) => `Still thinking it over, ${d.customerName}?`,
    intro: (d) => `Your basket of ${d.totalLabel} is saved and waiting.`,
    outro: (d) =>
      d.actionUrl ? `Pick up where you left off: ${d.actionUrl}` : 'Your basket is still saved.',
    whatsapp: (d) =>
      `Your ${d.storeName} basket (${d.totalLabel}) is still saved.${d.actionUrl ? ` Finish here: ${d.actionUrl}` : ''}`,
  },
  document_copy: {
    subject: (d) =>
      `${d.storeName}: your ${d.documentLabel ?? 'invoice'} for order #${d.orderNumber}`,
    heading: (d) => `Hi ${d.customerName}`,
    intro: (d) =>
      `Your ${d.documentLabel ?? 'invoice'} for order #${d.orderNumber} (${d.totalLabel}) is attached.`,
    outro: () => 'Keep it for your records.',
    whatsapp: (d) =>
      `${d.storeName}: your ${d.documentLabel ?? 'invoice'} for order #${d.orderNumber}.${d.links?.[0] ? ` Download: ${d.links[0].url}` : ''}`,
  },
  login_code: {
    subject: (d) => `${d.code} is your ${d.storeName} sign-in code`,
    heading: () => 'Your sign-in code',
    intro: (d) => `Enter ${d.code} to sign in to your ${d.storeName} account.`,
    outro: () =>
      'The code works once and expires in 10 minutes. If you did not ask for it, ignore this email.',
    whatsapp: (d) => `${d.code} is your ${d.storeName} sign-in code. It expires in 10 minutes.`,
  },
  account_deletion_code: {
    subject: (d) => `${d.code} is your code to delete your ${d.storeName} account`,
    heading: () => 'Confirm you want to delete your account',
    intro: (d) =>
      `Enter ${d.code} to confirm you want to delete your ${d.storeName} account. We will erase your personal data, except what the law makes us keep for invoices.`,
    outro: () =>
      'The code works once and expires in 10 minutes. If you did not ask for this, ignore this email and your account stays as it is.',
    whatsapp: (d) => `${d.code} is your ${d.storeName} code. It expires in 10 minutes.`,
  },
  login_link: {
    subject: (d) => `Your ${d.storeName} sign-in link`,
    heading: () => 'Sign in with one tap',
    intro: (d) => `Tap the button to sign in to your ${d.storeName} account.`,
    outro: () =>
      'The link works once and expires in 15 minutes. If you did not ask for it, ignore this email.',
    whatsapp: (d) =>
      `Sign in to ${d.storeName}: ${d.actionUrl ?? ''} (works once, expires in 15 minutes).`,
  },
  review_request: {
    subject: (d) => d.review?.subject || `How was your order from ${d.storeName}?`,
    heading: (d) => `Hi ${d.customerName}, how is it going?`,
    intro: (d) => {
      const names = (d.review?.items ?? []).map((i) => i.title)
      const what = names.length === 1 ? names[0] : 'what you bought'
      return `Your order${d.orderNumber ? ` #${d.orderNumber}` : ''} arrived a few days ago. Would you tell other shoppers what you think of ${what}? It takes a minute, and photos are welcome.`
    },
    outro: (d) =>
      d.review?.unsubscribeUrl
        ? 'Not keen on these emails? The "Stop review emails" link below ends them.'
        : '',
    whatsapp: (d) =>
      `${d.storeName}: how was your order? Leave a review: ${d.review?.items?.[0]?.url ?? ''}`,
  },
  review_reminder: {
    subject: (d) => d.review?.subject || `A quick review for ${d.storeName}?`,
    heading: (d) => `Hi ${d.customerName}, one quick question`,
    intro: (d) => {
      const names = (d.review?.items ?? []).map((i) => i.title)
      const what = names.length === 1 ? names[0] : 'your order'
      return `We would love to hear how ${what} is working out for you. Your review helps other shoppers choose, and it only takes a minute. This is the last time we ask.`
    },
    outro: (d) =>
      d.review?.unsubscribeUrl
        ? 'Not keen on these emails? The "Stop review emails" link below ends them.'
        : '',
    whatsapp: (d) => `${d.storeName}: a quick review? ${d.review?.items?.[0]?.url ?? ''}`,
  },
  review_reply: {
    subject: (d) => `${d.storeName} replied to your review`,
    heading: (d) => `Hi ${d.customerName}, ${d.storeName} replied`,
    intro: (d) =>
      `Thanks for reviewing ${d.review?.productTitle ?? 'your purchase'}. Here is the reply:

${d.review?.reply ?? ''}`,
    outro: () => 'The reply shows under your review on the product page.',
    whatsapp: (d) =>
      `${d.storeName} replied to your review of ${d.review?.productTitle ?? 'your purchase'}.`,
  },
  contact_message: {
    subject: (d) =>
      `${d.storeName}: new message from ${d.contactMessage?.name || d.contactMessage?.email || 'a shopper'}`,
    heading: () => 'You have a new message',
    intro: (d) => {
      const m = d.contactMessage
      const who = [m?.name, m?.email, m?.phone].filter(Boolean).join(' | ')
      return `${who} wrote${m?.path ? ` on ${m.path}` : ''}:

${m?.text ?? ''}`
    },
    outro: (d) =>
      d.contactMessage?.email
        ? `Reply to ${d.contactMessage.email} to answer. All messages are kept in Apps, Forms.`
        : 'All messages are kept in Apps, Forms.',
    whatsapp: (d) => `${d.storeName}: new message from ${d.contactMessage?.name || 'a shopper'}.`,
  },
  newsletter_confirm: {
    subject: (d) => `Confirm your ${d.storeName} newsletter signup`,
    heading: () => 'Please confirm your email',
    intro: (d) =>
      `Someone, hopefully you, asked to get emails from ${d.storeName} at this address. Tap the button to confirm.`,
    outro: () =>
      'The link works for 7 days. If you did not sign up, ignore this email and you will not hear from us.',
    whatsapp: (d) => `Confirm your ${d.storeName} newsletter signup: ${d.actionUrl ?? ''}`,
  },
  gift_card_issued: {
    subject: (d) => `${d.storeName}: your ${d.giftCard?.balanceLabel ?? ''} gift card`,
    heading: (d) => `Hi ${d.customerName}, here is your gift card`,
    intro: (d) =>
      `Use this code at checkout on ${d.storeName}. Any balance left stays on the card for next time.`,
    outro: (d) =>
      d.giftCard?.expiresLabel
        ? `Valid until ${d.giftCard.expiresLabel}.`
        : 'This gift card does not expire.',
    whatsapp: (d) =>
      `${d.storeName} gift card for ${d.giftCard?.balanceLabel ?? ''}: ${d.giftCard?.code ?? ''}. Use it at checkout.`,
  },
}

export const sharedContent = {
  itemsHeading: 'Items',
  totalLabel: 'Total',
  viewOrder: 'View your order',
  giftCardCode: 'Gift card code',
  giftCardBalance: 'Balance',
  giftCardMessage: 'Message',
  lineText: (l: TemplateData['lines'][number]) => `${l.title} x${l.quantity}, ${l.priceLabel}`,
  footer: (d: TemplateData) =>
    `Sent by ${d.storeName}. Reply to this email if anything looks wrong.`,
  parcels: {
    title: (count: number) => `Ships in ${count} parcels`,
    note: 'Your order comes from more than one warehouse, so it arrives in separate parcels, each with its own invoice.',
    parcel: (position: number, from: string) => `Parcel ${position} from ${from}`,
    item: (quantity: number, title: string) => `${quantity} × ${title}`,
    arrives: (range: string) => `Arrives ${range}`,
    onHold: 'Pre-order: ships when it arrives',
  },
} as const
