import { siteConfig } from '@commerce/config/site'
import type { TemplateData, TemplateId } from '../types'
import {
  backInStockTemplates,
  balanceTemplates,
  orderUpdateTemplates,
  platformTemplates,
  returnTemplates,
  shipmentTemplates,
  supplierTemplates,
  type TemplateCopy,
  transferTemplates,
} from './content-parts'

/** A draft invoice's number after the #: "D12" while it is a draft, else the order number. */
const draftRef = (d: TemplateData): string =>
  d.draftNumber ? `D${d.draftNumber}` : String(d.orderNumber)

export const templateContent: Record<TemplateId, TemplateCopy> = {
  ...platformTemplates,
  ...supplierTemplates,
  ...balanceTemplates,
  ...transferTemplates,
  ...backInStockTemplates,
  ...returnTemplates,
  ...shipmentTemplates,
  ...orderUpdateTemplates,
  cod_confirm: {
    subject: (d) => `${d.storeName}: please confirm your cash on delivery order #${d.orderNumber}`,
    heading: (d) => `Hi ${d.customerName}, is this order yours?`,
    intro: (d) =>
      `You chose cash on delivery for order #${d.orderNumber} of ${d.totalLabel}. Please confirm it so we can pack and ship it. If you did not mean to order, you can cancel it with the same link.`,
    outro: (d) =>
      d.actionUrl ? `Confirm or cancel here: ${d.actionUrl}` : 'Reply to this email to confirm.',
    whatsapp: (d) =>
      `${d.storeName}: please confirm your cash on delivery order #${d.orderNumber} of ${d.totalLabel}.${d.actionUrl ? ` Confirm or cancel: ${d.actionUrl}` : ''}`,
  },
  order_placed: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} received`,
    heading: (d) => `Thanks, ${d.customerName}`,
    intro: (d) =>
      `We have your order #${d.orderNumber} for ${d.totalLabel} (${d.paymentMethodLabel}).`,
    outro: (d) =>
      d.paymentInstructions?.length
        ? `To pay ${d.totalLabel}: ${d.paymentInstructions.join('. ')}. We ship once your payment arrives.`
        : 'We will message you again as soon as it ships.',
    whatsapp: (d) =>
      `Hi ${d.customerName}, ${d.storeName} has received order #${d.orderNumber} for ${d.totalLabel}.${d.paymentInstructions?.length ? ` To pay: ${d.paymentInstructions.join('. ')}.` : ''} We will update you when it ships.`,
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
    subject: (d) =>
      d.reminder
        ? `${d.storeName}: reminder, order #${draftRef(d)} is waiting for payment`
        : `${d.storeName}: your order #${draftRef(d)} is ready to pay`,
    heading: (d) => `Hi ${d.customerName}`,
    intro: (d) =>
      d.reminder
        ? `Order #${draftRef(d)} for ${d.totalLabel} is still waiting for your payment.`
        : `We have prepared order #${draftRef(d)} for ${d.totalLabel}.`,
    outro: (d) => (d.actionUrl ? `Pay securely here: ${d.actionUrl}` : 'Reply to confirm.'),
    whatsapp: (d) =>
      `${d.storeName}: order #${draftRef(d)} for ${d.totalLabel} is ready.${d.actionUrl ? ` Pay: ${d.actionUrl}` : ''}`,
  },
  checkout_recovery: {
    subject: (d) => `${d.storeName}: your basket is saved`,
    heading: (d) => `Hi ${d.customerName}, your basket is saved`,
    intro: (d) => `You left items worth ${d.totalLabel} in your basket.`,
    outro: (d) =>
      d.actionUrl ? `Finish your order here: ${d.actionUrl}` : 'Your basket is still saved.',
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
  // The merchant's subject and message ride on `custom`; the message prints under the greeting.
  customer_message: {
    subject: (d) => `A message from ${d.storeName}`,
    heading: (d) => (d.customerName ? `Hi ${d.customerName}` : 'Hi'),
    intro: () => '',
    outro: () => '',
    whatsapp: (d) => `${d.storeName}: ${d.custom?.message ?? ''}`,
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
    heading: (d) => `Hi ${d.customerName}, how was your order?`,
    intro: (d) => {
      const names = (d.review?.items ?? []).map((i) => i.title)
      const what = names.length === 1 ? names[0] : 'what you bought'
      return `Your order${d.orderNumber ? ` #${d.orderNumber}` : ''} arrived a few days ago. Would you tell other shoppers what you think of ${what}? It takes a minute, and photos are welcome.`
    },
    outro: (d) =>
      d.review?.unsubscribeUrl
        ? 'To stop review emails, use the "Stop review emails" link below.'
        : '',
    whatsapp: (d) =>
      `${d.storeName}: how was your order? Leave a review: ${d.review?.items?.[0]?.url ?? ''}`,
  },
  review_reminder: {
    subject: (d) => d.review?.subject || `A quick review for ${d.storeName}?`,
    heading: (d) => `Hi ${d.customerName}, a review reminder`,
    intro: (d) => {
      const names = (d.review?.items ?? []).map((i) => i.title)
      const what = names.length === 1 ? names[0] : 'your order'
      return `We would love to hear how ${what} is working out for you. Your review helps other shoppers choose, and it only takes a minute. This is the last time we ask.`
    },
    outro: (d) =>
      d.review?.unsubscribeUrl
        ? 'To stop review emails, use the "Stop review emails" link below.'
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
  review_reward: {
    subject: (d) => `A thank-you from ${d.storeName} for your photo review`,
    heading: (d) => `Thanks for the photos, ${d.customerName}`,
    intro: (d) =>
      `Your review of ${d.review?.productTitle ?? 'your purchase'} is live, photos and all. Here is ${d.review?.rewardLabel ?? 'a discount'} on your next order with this code:

${d.review?.rewardCode ?? ''}`,
    outro: (d) =>
      d.review?.rewardUntil
        ? `The code works once, until ${d.review.rewardUntil}.`
        : 'The code works once.',
    whatsapp: (d) =>
      `${d.storeName}: thanks for your photo review! ${d.review?.rewardLabel ?? 'A discount'} with code ${d.review?.rewardCode ?? ''}`,
  },
  question_answered: {
    subject: (d) => `${d.storeName} answered your question`,
    heading: (d) =>
      d.customerName ? `Hi ${d.customerName}, here is your answer` : 'Here is your answer',
    intro: (d) =>
      `You asked about ${d.review?.productTitle ?? 'a product'}:

"${d.review?.question ?? ''}"

${d.storeName} answered:

${d.review?.answer ?? ''}`,
    outro: () => 'The question and answer now show on the product page for other shoppers too.',
    whatsapp: (d) =>
      `${d.storeName} answered your question about ${d.review?.productTitle ?? 'a product'}.${d.review?.productUrl ? ` See it: ${d.review.productUrl}` : ''}`,
  },
  question_asked: {
    subject: (d) => `${d.storeName}: new question about ${d.review?.productTitle ?? 'a product'}`,
    heading: () => 'A shopper asked a question',
    intro: (d) =>
      `${d.review?.askerName || 'A shopper'}${d.review?.askerEmail ? ` (${d.review.askerEmail})` : ''} asked about ${d.review?.productTitle ?? 'a product'}:

"${d.review?.question ?? ''}"`,
    outro: () =>
      'Answer it in Apps, Reviews, Questions. Once you publish the answer, it shows on the product page and the shopper gets it by email.',
    whatsapp: (d) =>
      `${d.storeName}: new question about ${d.review?.productTitle ?? 'a product'}.${d.actionUrl ? ` Answer: ${d.actionUrl}` : ''}`,
  },
  affiliate_update: {
    subject: (d) => {
      const a = d.affiliate
      if (a?.kind === 'approved') return `You are in: the ${d.storeName} affiliate program`
      if (a?.kind === 'payout') return `${d.storeName} sent your payout`
      if (a?.kind === 'rejected') return `Your ${d.storeName} affiliate application`
      return `New sale through your ${d.storeName} link`
    },
    heading: (d) => `Hi ${d.affiliate?.name || 'there'}`,
    intro: (d) => {
      const a = d.affiliate
      if (a?.kind === 'approved') {
        return [
          `Welcome to the ${d.storeName} affiliate program. Share your link and earn on every sale it brings.`,
          a.link ? `Your link: ${a.link}` : '',
          a.couponCode ? `Your code for followers: ${a.couponCode}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      }
      if (a?.kind === 'rejected') {
        return [
          `Thank you for applying to the ${d.storeName} affiliate program. This time the store did not approve your application.`,
          a.reason ? `Their note: ${a.reason}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      }
      if (a?.kind === 'payout') {
        return [
          `${d.storeName} has paid you ${a.amountLabel ?? ''}.`,
          a.tdsLabel ? `TDS deducted: ${a.tdsLabel}.` : '',
          a.reference ? `Reference: ${a.reference}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      }
      return `Someone just ordered through your link or code. You earn ${a?.amountLabel ?? 'a commission'} once the order is delivered and the return window has passed.`
    },
    outro: () => 'Your dashboard shows your clicks, sales and earnings.',
    whatsapp: (d) => `${d.storeName} affiliate program: ${d.affiliate?.portalUrl ?? ''}`,
  },
  affiliate_application: {
    subject: (d) => `New affiliate application: ${d.affiliate?.name || 'someone'}`,
    heading: () => 'New affiliate application',
    intro: (d) => {
      const a = d.affiliate
      return [
        `${a?.name || 'Someone'} applied to your affiliate program and is waiting for your approval.`,
        a?.email ? `Email: ${a.email}` : '',
        a?.social ? `Posts on: ${a.social}` : '',
        a?.message ? `They wrote: ${a.message}` : '',
        a?.adminUrl ? `Approve or decline: ${a.adminUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    },
    outro: () => 'You get this email because the Affiliates app is installed.',
    whatsapp: (d) => `New affiliate application: ${d.affiliate?.name ?? ''}`,
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
      `Someone asked to get emails from ${d.storeName} at this address. If it was you, tap the button to confirm.`,
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
  lineText: (l: TemplateData['lines'][number]) =>
    `${l.title} x${l.quantity}, ${l.priceLabel}${l.note ? ` (${l.note.replace(/\s+/g, ' ')})` : ''}`,
  footer: (d: TemplateData) =>
    `Sent by ${d.storeName}. Reply to this email if anything looks wrong.`,
  itemsTitle: 'Order summary',
  qty: (n: number) => `Qty ${n}`,
  layout: {
    shop: 'Shop',
    track: 'Track order',
    contact: 'Contact',
    helpTitle: 'Need help?',
    helpBody: 'Reply to this email or reach us here. We usually answer within a few hours.',
    whatsapp: 'WhatsApp',
    poweredBy: `Powered by ${siteConfig.brand.name}`,
    unsubscribe: 'Unsubscribe',
  },
  deliverySteps: ['Confirmed', 'Shipped', 'Out for delivery', 'Delivered'],
  returnSteps: ['Requested', 'Approved', 'Received', 'Refunded'],
  awb: (courier: string | undefined, waybill: string) =>
    courier ? `${courier} · AWB ${waybill}` : `AWB ${waybill}`,
  giftCardLabel: 'Your gift card code',
  codeLabel: 'Your code',
  parcels: {
    title: (count: number) => `Ships in ${count} parcels`,
    note: 'Your order comes from more than one warehouse, so it arrives in separate parcels, each with its own invoice.',
    parcel: (position: number, from: string) => `Parcel ${position} from ${from}`,
    item: (quantity: number, title: string) => `${quantity} × ${title}`,
    arrives: (range: string) => `Arrives ${range}`,
    onHold: 'Pre-order: ships when it arrives',
  },
} as const
