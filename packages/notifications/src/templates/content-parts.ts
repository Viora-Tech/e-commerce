import { siteConfig } from '@commerce/config/site'
import type { TemplateData } from '../types'

/**
 * Every word a shopper receives. Change copy here, never inside a renderer.
 * `subject`/`heading`/`intro`/`outro` feed email; `whatsapp` is the short form.
 */
export type TemplateCopy = {
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

/** The balance an order edit left (the store changed a paid order and the total went up). */
const edited = (d: TemplateData): boolean => d.balance?.kind === 'edit'
/** "pre-order #12" for a deposit pre-order, "order #12" for an edited order. */
const orderRef = (d: TemplateData): string =>
  `${edited(d) ? 'order' : 'pre-order'} #${d.orderNumber}`

export const balanceTemplates = {
  balance_request: {
    subject: (d) =>
      edited(d)
        ? `${d.storeName}: order #${d.orderNumber} was updated, ${d.balance?.dueLabel ?? ''} due`
        : `${d.storeName}: order #${d.orderNumber} is almost ready, balance due`,
    heading: (d) =>
      edited(d)
        ? `Hi ${d.customerName}, your order was updated`
        : `Hi ${d.customerName}, your pre-order is nearly here`,
    intro: (d) =>
      edited(d)
        ? `We changed order #${d.orderNumber} as agreed. You have paid ${d.balance?.depositLabel ?? ''} so far, and ${d.balance?.dueLabel ?? ''} more is now due.`
        : `You paid ${d.balance?.depositLabel ?? ''} up front for order #${d.orderNumber}. The balance of ${d.balance?.dueLabel ?? ''} is now due.${payBy(d)}${keepNote(d)}`,
    outro: (d) =>
      d.actionUrl ? `Pay the balance here: ${d.actionUrl}` : 'Reply to this email to pay.',
    whatsapp: (d) =>
      `${d.storeName}: balance of ${d.balance?.dueLabel ?? ''} is due for ${orderRef(d)}.${payBy(d)}${d.actionUrl ? ` Pay: ${d.actionUrl}` : ''}`,
  },
  balance_reminder: {
    subject: (d) => `${d.storeName}: reminder, balance due for order #${d.orderNumber}`,
    heading: (d) => `Hi ${d.customerName}, a balance is due`,
    intro: (d) =>
      `The balance of ${d.balance?.dueLabel ?? ''} for ${orderRef(d)} is still due.${payBy(d)}${keepNote(d)}`,
    outro: (d) =>
      d.actionUrl ? `Pay the balance here: ${d.actionUrl}` : 'Reply to this email to pay.',
    whatsapp: (d) =>
      `Reminder from ${d.storeName}: ${d.balance?.dueLabel ?? ''} is still due for ${orderRef(d)}.${payBy(d)}${d.actionUrl ? ` Pay: ${d.actionUrl}` : ''}`,
  },
  balance_received: {
    subject: (d) => `${d.storeName}: balance for order #${d.orderNumber} received`,
    heading: () => 'Balance received',
    intro: (d) => `Order #${d.orderNumber} is now paid in full (${d.totalLabel}).`,
    outro: () => 'We will message you again as soon as it ships.',
    whatsapp: (d) =>
      `${d.storeName}: balance received, ${orderRef(d)} is paid in full. We will update you when it ships.`,
  },
} satisfies Record<'balance_request' | 'balance_reminder' | 'balance_received', TemplateCopy>

/** "Asha" for a staff alert, or "A customer" when the order has no name ("there" is the shopper fallback). */
const buyer = (d: TemplateData): string =>
  d.customerName && d.customerName !== 'there' ? d.customerName : 'A customer'
const ordersCount = (n: number): string => (n === 1 ? '1 order' : `${n} orders`)

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
    outro: () => 'If you have paid, reply to this email and we will check.',
    whatsapp: (d) =>
      `${d.storeName}: order #${d.orderNumber} was cancelled because the ${d.totalLabel} payment did not arrive. If you paid, reply to this message.`,
  },
  staff_new_order: {
    subject: (d) => `${d.storeName}: new order #${d.orderNumber} (${d.totalLabel})`,
    heading: (d) => `New order #${d.orderNumber}`,
    intro: (d) =>
      `${buyer(d)} placed an order for ${d.totalLabel}${d.paymentMethodLabel ? `, paid by ${d.paymentMethodLabel}` : ''}.`,
    outro: () =>
      'You get this because new-order alerts are on in your admin, under Account → Notifications.',
    whatsapp: (d) =>
      `${d.storeName}: new order #${d.orderNumber}, ${d.totalLabel}.${d.actionUrl ? ` Open: ${d.actionUrl}` : ''}`,
  },
  staff_daily_summary: {
    subject: (d) =>
      `${d.storeName}: ${ordersCount(d.dailySummary?.orders ?? 0)}, ${d.dailySummary?.salesLabel ?? ''}`,
    heading: (d) => `Your day at ${d.storeName}`,
    intro: (d) => {
      const s = d.dailySummary
      if (!s) return ''
      return `${s.periodLabel}: ${ordersCount(s.orders)} worth ${s.salesLabel}. ${
        s.toShip === 1 ? '1 order is' : `${s.toShip} orders are`
      } waiting to be shipped.`
    },
    outro: () =>
      'You get this every day at the time you chose in your admin, under Account → Notifications.',
    whatsapp: (d) =>
      `${d.storeName} ${d.dailySummary?.periodLabel ?? ''}: ${ordersCount(d.dailySummary?.orders ?? 0)}, ${d.dailySummary?.salesLabel ?? ''}, ${d.dailySummary?.toShip ?? 0} to ship.`,
  },
} satisfies Record<
  | 'payment_reminder'
  | 'unpaid_cancel_notice'
  | 'unpaid_cancelled'
  | 'staff_new_order'
  | 'staff_daily_summary',
  TemplateCopy
>

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
        ? `Buy it here: ${d.backInStock.productUrl}`
        : 'You can order it on the store now.',
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
const fromOrder = (d: TemplateData): string =>
  d.returnInfo?.originalOrderNumber ? ` (order #${d.returnInfo.originalOrderNumber})` : ''
const howBack = (d: TemplateData): string =>
  d.returnInfo?.pickup === 'courier'
    ? `A courier will come to collect it${d.returnInfo.pickupWaybill ? ` (tracking number ${d.returnInfo.pickupWaybill})` : ''}. Please pack the items safely and keep them ready.`
    : 'Please pack the items safely and send them back to us. Reply to this email if you need our address.'

export const returnTemplates = {
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
    intro: (d) => `We accepted return ${ret(d)} for order #${d.orderNumber}.`,
    outro: (d) => howBack(d),
    whatsapp: (d) =>
      `${d.storeName}: return ${ret(d)} for order #${d.orderNumber} is approved. ${howBack(d)}`,
  },
  return_rejected: {
    subject: (d) => `${d.storeName}: about your return request for order #${d.orderNumber}`,
    heading: (d) => `Hi ${d.customerName}, we could not accept this return`,
    intro: (d) =>
      `We are sorry, return ${ret(d)} for order #${d.orderNumber} was not accepted.${d.returnInfo?.decisionNote ? ` Reason: ${d.returnInfo.decisionNote}` : ''}`,
    outro: () => 'If you think this is a mistake, reply to this email and we will look again.',
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
    outro: () => 'Reply to this email if anything is not right.',
    whatsapp: (d) =>
      `${d.storeName}: refund of ${d.returnInfo?.refundLabel ?? d.totalLabel} for return ${ret(d)} is on its way ${d.returnInfo?.refundMethod === 'store_credit' ? 'as store credit' : 'to the way you paid'}.`,
  },
  return_exchanged: {
    subject: (d) => `${d.storeName}: your exchange for return ${ret(d)} is on its way`,
    heading: (d) => `Hi ${d.customerName}, your exchange is on its way`,
    intro: (d) =>
      `We are sending the replacement for return ${ret(d)}${fromOrder(d)} as order #${d.orderNumber}, at no charge.`,
    outro: (d) =>
      d.orderUrl
        ? `We will message you again when it ships. Follow it here: ${d.orderUrl}`
        : 'We will message you again when it ships.',
    whatsapp: (d) =>
      `${d.storeName}: your exchange for return ${ret(d)} is on its way as order #${d.orderNumber}.${d.orderUrl ? ` Follow it: ${d.orderUrl}` : ''}`,
  },
} satisfies Record<
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected'
  | 'return_received'
  | 'return_refunded'
  | 'return_exchanged',
  TemplateCopy
>

/** Shipment status and order lifecycle messages not already covered above. */
export const shipmentTemplates = {
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
    intro: (d) => `Order #${d.orderNumber} has been delivered.`,
    outro: () => 'If something is wrong with it, reply to this email.',
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

const withCourier = (d: TemplateData): string => (d.courierLabel ? ` with ${d.courierLabel}` : '')

/** Order updates the shopper gets between the order and its delivery: edits, payment, tracking, the order link. */
export const orderUpdateTemplates = {
  order_edited: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} was updated`,
    heading: (d) => `Hi ${d.customerName}, we updated your order`,
    intro: (d) =>
      `We made changes to order #${d.orderNumber}. Here is the order as it stands now, with a new total of ${d.totalLabel}.`,
    outro: () =>
      'If you paid already, any difference is settled separately: we send a link for anything more and refund anything less. Reply to this email if something looks wrong.',
    whatsapp: (d) =>
      `${d.storeName}: order #${d.orderNumber} was updated. New total ${d.totalLabel}.${d.orderUrl ? ` See it: ${d.orderUrl}` : ''}`,
  },
  payment_pending: {
    subject: (d) => `${d.storeName}: your order #${d.orderNumber} is waiting for payment`,
    heading: (d) => `Hi ${d.customerName}, your payment is not finished`,
    intro: (d) =>
      `We could not confirm the ${d.totalLabel} payment for order #${d.orderNumber}. If the payment failed or the page closed, you can try again. We are holding your items for now.`,
    outro: (d) =>
      `${d.orderUrl ? `Retry your payment here: ${d.orderUrl}. ` : ''}If money left your account, it is not lost: it either confirms the order or goes back to you by itself.`,
    whatsapp: (d) =>
      `${d.storeName}: your order #${d.orderNumber} is waiting for payment of ${d.totalLabel}.${d.orderUrl ? ` Retry: ${d.orderUrl}` : ''}`,
  },
  shipping_update: {
    subject: (d) => `${d.storeName}: new tracking details for order #${d.orderNumber}`,
    heading: () => 'Your tracking details changed',
    intro: (d) =>
      `Order #${d.orderNumber} now ships${withCourier(d)}.${d.waybill ? ` The new tracking number is ${d.waybill}.` : ''} Please use these details from now on.`,
    outro: (d) =>
      d.trackingUrl ? `Track it here: ${d.trackingUrl}` : 'Tracking updates follow shortly.',
    whatsapp: (d) =>
      `${d.storeName} order #${d.orderNumber} has new tracking details${withCourier(d)}.${d.waybill ? ` AWB ${d.waybill}.` : ''}${d.trackingUrl ? ` Track: ${d.trackingUrl}` : ''}`,
  },
  order_link: {
    subject: (d) => `${d.storeName}: your order #${d.orderNumber}`,
    heading: (d) => `Hi ${d.customerName}`,
    intro: (d) =>
      `Here is the link to order #${d.orderNumber} (${d.totalLabel}). It shows what you ordered, the payment and where your parcel is.`,
    outro: (d) =>
      d.orderUrl ? `See your order: ${d.orderUrl}` : 'Reply to this email with any questions.',
    whatsapp: (d) =>
      `${d.storeName}: here is your order #${d.orderNumber}.${d.orderUrl ? ` See it: ${d.orderUrl}` : ''}`,
  },
} satisfies Record<
  'order_edited' | 'payment_pending' | 'shipping_update' | 'order_link',
  TemplateCopy
>

const platformName = (d: TemplateData): string =>
  d.staffInvite?.platformName || siteConfig.brand.name
const asRole = (d: TemplateData): string =>
  d.staffInvite?.roleLabel ? ` as ${d.staffInvite.roleLabel}` : ''
const invitedBy = (d: TemplateData): string => d.staffInvite?.inviterEmail || 'The store owner'

/** Messages the platform sends about itself, through its own email account. */
export const platformTemplates = {
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
  email_change_code: {
    subject: (d) => `${d.code} is your code to confirm your new ${d.storeName} email`,
    heading: () => 'Confirm your new email',
    intro: (d) =>
      `Enter ${d.code} on the Sign-in & security page to make this the email you sign in to ${d.storeName} with.`,
    outro: () =>
      'The code works once and expires in 10 minutes. If you did not ask for this, ignore this email and nothing changes.',
    whatsapp: (d) => `${d.code} confirms your new ${d.storeName} email. It expires in 10 minutes.`,
  },
  email_changed: {
    subject: (d) => `Your ${d.storeName} sign-in email was changed`,
    heading: () => 'Your sign-in email was changed',
    intro: (d) =>
      `You now sign in to ${d.storeName} with ${d.emailChange?.newEmail ?? 'a new email address'}. Sign-in codes no longer come to this address.`,
    outro: () =>
      `If you did not make this change, tell your store owner straight away or write to ${siteConfig.contact.supportEmail}.`,
    whatsapp: (d) =>
      `Your ${d.storeName} sign-in email was changed to ${d.emailChange?.newEmail ?? 'a new address'}.`,
  },
  plan_bill: {
    subject: (d) =>
      d.planBill?.kind === 'fair_use'
        ? `${d.storeName} is past its plan's fair-use visits`
        : d.planBill?.kind === 'overdue'
          ? `Your ${d.planBill.platformName} bill for ${d.storeName} is overdue`
          : `Your ${d.planBill?.platformName ?? siteConfig.brand.name} bill for ${d.storeName}: ${d.planBill?.amountLabel ?? ''}`,
    heading: (d) =>
      d.planBill?.kind === 'fair_use'
        ? 'Your store is busier than its plan'
        : d.planBill?.kind === 'overdue'
          ? 'Your bill is overdue'
          : 'Your bill is ready',
    intro: (d) => {
      const b = d.planBill
      if (!b) return ''
      if (b.kind === 'overdue')
        return `${b.amountLabel} for ${b.what} is still unpaid. Your paid time ended on ${b.dueLabel}; pay now to keep everything working.`
      if (b.kind === 'renewal')
        return `${b.what} renews on ${b.dueLabel}. Pay ${b.amountLabel} (including GST) by then to keep it running.`
      if (b.kind === 'fair_use')
        return `Your store had more visits than the ${b.what} allows, two months running. Nothing is blocked or charged. Someone from ${b.platformName} will get in touch to find the right plan with you.`
      if (b.kind === 'usage')
        return `${b.what}: ${b.amountLabel} (including GST), for the orders past your plan's included ones. Please pay by ${b.dueLabel}. Nothing is paused while it waits; if it is still unpaid at your next renewal, it is added to that bill.`
      return `${b.amountLabel} (including GST) for ${b.what}. It starts as soon as the payment goes through.`
    },
    outro: (d) =>
      d.planBill?.kind === 'fair_use'
        ? `${d.actionUrl ? `See your plan: ${d.actionUrl}. ` : ''}Questions? Write to ${siteConfig.contact.supportEmail}.`
        : `${d.actionUrl ? `Pay here: ${d.actionUrl}. ` : ''}Pay with UPI, card or netbanking. Your GST invoice comes by email once it is paid. Questions? Write to ${siteConfig.contact.supportEmail}.`,
    whatsapp: (d) =>
      `${d.storeName}: ${d.planBill?.amountLabel ?? ''} due for ${d.planBill?.what ?? 'your plan'}.${d.actionUrl ? ` Pay: ${d.actionUrl}` : ''}`,
  },
  bug_report_update: {
    subject: (d) =>
      d.bugReport?.status === 'live'
        ? `Fixed and live: ${d.bugReport.title}`
        : `Fixed in the next update: ${d.bugReport?.title ?? 'your bug report'}`,
    heading: (d) =>
      d.bugReport?.status === 'live' ? 'Your bug report is fixed' : 'We fixed your bug report',
    intro: (d) =>
      d.bugReport?.status === 'live'
        ? `The fix for "${d.bugReport.title}" is now live in ${d.storeName}. Thanks for telling us.`
        : `We fixed "${d.bugReport?.title ?? 'your report'}". It reaches ${d.storeName} with the next update.`,
    outro: (d) =>
      `${d.actionUrl ? `See all your reports: ${d.actionUrl}. ` : ''}You get these because "Your bug reports" is on in Account → Notifications.`,
    whatsapp: (d) =>
      `${d.storeName}: your bug report "${d.bugReport?.title ?? ''}" is ${d.bugReport?.status === 'live' ? 'fixed and live' : 'fixed, live with the next update'}.`,
  },
} satisfies Record<
  'staff_invite' | 'email_change_code' | 'email_changed' | 'plan_bill' | 'bug_report_update',
  TemplateCopy
>

const poLabel = (d: TemplateData): string => d.purchaseOrder?.numberLabel ?? ''
const poExpected = (d: TemplateData): string =>
  d.purchaseOrder?.expectedLabel
    ? ` We expect it to arrive by ${d.purchaseOrder.expectedLabel}.`
    : ''

/** Messages a store sends to its suppliers, not its shoppers. */
export const supplierTemplates = {
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
