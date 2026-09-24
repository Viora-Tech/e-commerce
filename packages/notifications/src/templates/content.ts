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

export const templateContent: Record<TemplateId, TemplateCopy> = {
  ...balanceTemplates,
  ...backInStockTemplates,
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
} as const
