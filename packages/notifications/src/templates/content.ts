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

export const templateContent: Record<TemplateId, TemplateCopy> = {
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
}

export const sharedContent = {
  itemsHeading: 'Items',
  totalLabel: 'Total',
  viewOrder: 'View your order',
  lineText: (l: TemplateData['lines'][number]) => `${l.title} x${l.quantity}, ${l.priceLabel}`,
  footer: (d: TemplateData) =>
    `Sent by ${d.storeName}. Reply to this email if anything looks wrong.`,
} as const
