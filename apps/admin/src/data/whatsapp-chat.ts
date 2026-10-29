/** What a click-to-chat message is filled with; links are absent when they do not apply. */
export type WhatsappChatVars = {
  storeName: string
  customerName: string | null
  orderNumber: number | null
  totalLabel: string | null
  waybill: string | null
  link: string | null
}

const hi = (name: string | null) => (name ? `Hi ${name}` : 'Hi there')
const orderRef = (n: number | null) => (n ? `order #${n}` : 'order')

/**
 * "WhatsApp" click to chat on orders, drafts, customers and abandoned checkouts: the staff
 * member picks a message, edits it and opens their own WhatsApp to send it.
 */
export const whatsappChatContent = {
  action: 'WhatsApp',
  title: 'Chat on WhatsApp',
  help: 'Opens WhatsApp (the app or WhatsApp Web) with this message typed in. Nothing is sent until you press send there.',
  loading: 'Loading the customer’s details',
  failed: 'Could not load the customer’s details. Try again in a moment.',
  noPhone: 'There is no phone number to chat with.',
  to: 'To',
  templateLabel: 'Message',
  messageLabel: 'Text',
  messagePlaceholder: 'Type your message',
  cancel: 'Cancel',
  open: 'Open WhatsApp',
  templates: {
    payment: 'Payment link',
    order_confirmation: 'Order confirmation',
    shipping_update: 'Shipping update',
    cart_recovery: 'Abandoned cart',
    blank: 'Blank',
  },
  messages: {
    payment: (v: WhatsappChatVars) =>
      `${hi(v.customerName)}, this is ${v.storeName}. Your ${orderRef(v.orderNumber)}${v.totalLabel ? ` of ${v.totalLabel}` : ''} is waiting for payment. You can pay here: ${v.link ?? ''}`,
    order_confirmation: (v: WhatsappChatVars) =>
      `${hi(v.customerName)}, thank you for your ${orderRef(v.orderNumber)} with ${v.storeName}! We have received it and will let you know when it ships.${v.link ? ` View your order: ${v.link}` : ''}`,
    shipping_update: (v: WhatsappChatVars) =>
      `${hi(v.customerName)}, your ${v.storeName} ${orderRef(v.orderNumber)} is on its way.${v.waybill ? ` Tracking number: ${v.waybill}.` : ''}${v.link ? ` Track it here: ${v.link}` : ''}`,
    cart_recovery: (v: WhatsappChatVars) =>
      `${hi(v.customerName)}, you left a few things in your cart at ${v.storeName}. Your items are saved, finish your order here: ${v.link ?? ''}`,
    blank: (_v: WhatsappChatVars) => '',
  },
}
