import type { TemplateCopy } from './content-parts'

/**
 * Staff asked a cash on delivery shopper to pay online instead ("Ask to pay online"), usually
 * because no courier takes cash on delivery to their PIN code. The link opens their order page,
 * where "Pay online now" takes them to the store's gateway. The same message is the one reminder.
 */
export const payOnlineTemplates = {
  cod_pay_online: {
    subject: (d) => `${d.storeName}: please pay online for order #${d.orderNumber}`,
    heading: (d) => `Hi ${d.customerName}, can you pay online for this order?`,
    intro: (d) =>
      `Cash on delivery isn't available for order #${d.orderNumber} at your address. Pay ${d.totalLabel} online with UPI, card or netbanking and we ship it right away. Nothing else about your order changes.`,
    outro: (d) =>
      d.orderUrl
        ? `Pay securely from your order page: ${d.orderUrl}`
        : 'Reply to this email and we will send you a payment link.',
    whatsapp: (d) =>
      `${d.storeName}: cash on delivery isn't available for order #${d.orderNumber} at your address. Pay ${d.totalLabel} online and we ship it right away.${d.orderUrl ? ` Pay here: ${d.orderUrl}` : ''}`,
  },
} satisfies Record<'cod_pay_online', TemplateCopy>
