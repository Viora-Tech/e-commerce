import type { WhatsappChatTemplate } from '@commerce/core'
import type { WhatsappChatVars } from '@/data/whatsapp-chat'
import type { api } from './api-client'

/** What the click-to-chat dialog is about; drafts are orders. */
export type WhatsappChatTarget = { kind: 'order' | 'customer' | 'checkout'; id: string }

export type WhatsappChatInfo = Awaited<ReturnType<typeof api.orders.whatsappChat>>

/** Every message, in the order the picker lists them. */
export const CHAT_TEMPLATES: readonly WhatsappChatTemplate[] = [
  'payment',
  'order_confirmation',
  'shipping_update',
  'cart_recovery',
  'blank',
]

/** Which one opens first: the most timely message the details allow. */
const PREFERRED: readonly WhatsappChatTemplate[] = [
  'cart_recovery',
  'payment',
  'shipping_update',
  'order_confirmation',
  'blank',
]

/** The link a message carries, or null when it needs none or there is none. */
export function chatLinkFor(template: WhatsappChatTemplate, info: WhatsappChatInfo): string | null {
  if (template === 'payment') return info.links.payment ?? null
  if (template === 'order_confirmation') return info.links.order ?? null
  if (template === 'shipping_update') return info.links.tracking ?? null
  if (template === 'cart_recovery') return info.links.recovery ?? null
  return null
}

/** The messages these details can fill: each linked one only with its link; blank always. */
export function chatTemplatesFor(info: WhatsappChatInfo): WhatsappChatTemplate[] {
  return CHAT_TEMPLATES.filter((t) => {
    if (t === 'blank') return true
    if (t === 'shipping_update') return Boolean(info.links.tracking || info.waybill)
    return chatLinkFor(t, info) !== null
  })
}

/** The message the dialog starts on. */
export function defaultChatTemplate(info: WhatsappChatInfo): WhatsappChatTemplate {
  const available = chatTemplatesFor(info)
  return PREFERRED.find((t) => available.includes(t)) ?? 'blank'
}

/** The fill-ins for one message. */
export function chatVars(template: WhatsappChatTemplate, info: WhatsappChatInfo): WhatsappChatVars {
  return {
    storeName: info.storeName,
    customerName: info.customerName,
    orderNumber: info.orderNumber,
    totalLabel: info.totalLabel,
    waybill: info.waybill,
    link: chatLinkFor(template, info),
  }
}
