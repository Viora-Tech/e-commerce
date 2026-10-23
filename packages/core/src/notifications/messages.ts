/** SOURCE OF TRUTH: transactional message catalogue — WHAT: every message the platform sends, who gets it, how it is triggered and whether a merchant may switch it off / WHY: Settings → Notifications lists these and delivery skips the ones a store turned off */
import type { TemplateId } from '@commerce/notifications'
import type { NotificationSettings } from './settings'

/**
 * How a message goes out:
 * - `auto`: sent by the platform when something happens; the merchant can switch it off.
 * - `manual`: only when the merchant clicks a Send button (invoice, reminder).
 * - `always`: needed for the shop to work (sign-in codes, gift card codes); cannot be switched off.
 * - `app`: sent by an installed app, which has its own settings.
 */
export type MessageTrigger = 'auto' | 'manual' | 'always' | 'app'

/** Groups in the order Settings → Notifications shows them. */
export type MessageGroup =
  | 'orders'
  | 'returns'
  | 'transfer'
  | 'preorder'
  | 'manual'
  | 'account'
  | 'app'
  | 'you'

export type MessageChannelKind = 'email' | 'whatsapp'

export type MessageDef = {
  id: TemplateId
  group: MessageGroup
  trigger: MessageTrigger
  /** Channels able to carry it. Gift cards and most messages to the merchant are email only; a team member's own alerts can also go by WhatsApp. */
  channels: readonly MessageChannelKind[]
  /** The app whose settings control an `app` message. */
  appId?: string | undefined
}

const BOTH = ['email', 'whatsapp'] as const
const EMAIL = ['email'] as const

export const MESSAGE_CATALOGUE: readonly MessageDef[] = [
  { id: 'order_placed', group: 'orders', trigger: 'auto', channels: BOTH },
  { id: 'payment_received', group: 'orders', trigger: 'auto', channels: BOTH },
  { id: 'order_shipped', group: 'orders', trigger: 'auto', channels: BOTH },
  { id: 'out_for_delivery', group: 'orders', trigger: 'auto', channels: BOTH },
  { id: 'delivered', group: 'orders', trigger: 'auto', channels: BOTH },
  { id: 'delivery_failed', group: 'orders', trigger: 'auto', channels: BOTH },
  { id: 'order_cancelled', group: 'orders', trigger: 'auto', channels: BOTH },
  { id: 'refund_issued', group: 'orders', trigger: 'auto', channels: BOTH },
  { id: 'return_requested', group: 'returns', trigger: 'auto', channels: BOTH },
  { id: 'return_approved', group: 'returns', trigger: 'auto', channels: BOTH },
  { id: 'return_rejected', group: 'returns', trigger: 'auto', channels: BOTH },
  { id: 'return_received', group: 'returns', trigger: 'auto', channels: BOTH },
  { id: 'return_refunded', group: 'returns', trigger: 'auto', channels: BOTH },
  { id: 'unpaid_cancelled', group: 'transfer', trigger: 'auto', channels: BOTH },
  { id: 'balance_request', group: 'preorder', trigger: 'auto', channels: BOTH },
  { id: 'balance_reminder', group: 'preorder', trigger: 'auto', channels: BOTH },
  { id: 'balance_received', group: 'preorder', trigger: 'auto', channels: BOTH },
  { id: 'payment_reminder', group: 'manual', trigger: 'manual', channels: BOTH },
  { id: 'draft_invoice', group: 'manual', trigger: 'manual', channels: BOTH },
  { id: 'checkout_recovery', group: 'manual', trigger: 'manual', channels: BOTH },
  { id: 'document_copy', group: 'manual', trigger: 'manual', channels: EMAIL },
  { id: 'purchase_order', group: 'manual', trigger: 'manual', channels: EMAIL },
  { id: 'login_code', group: 'account', trigger: 'always', channels: EMAIL },
  { id: 'account_deletion_code', group: 'account', trigger: 'always', channels: EMAIL },
  { id: 'login_link', group: 'account', trigger: 'always', channels: EMAIL },
  { id: 'newsletter_confirm', group: 'account', trigger: 'always', channels: EMAIL },
  { id: 'gift_card_issued', group: 'account', trigger: 'always', channels: EMAIL },
  {
    id: 'back_in_stock_confirm',
    group: 'app',
    trigger: 'app',
    channels: BOTH,
    appId: 'back-in-stock',
  },
  {
    id: 'back_in_stock_alert',
    group: 'app',
    trigger: 'app',
    channels: BOTH,
    appId: 'back-in-stock',
  },
  { id: 'unpaid_cancel_notice', group: 'you', trigger: 'auto', channels: EMAIL },
  // Each team member chooses these for themselves (Account → Notifications); the switch here
  // turns them off for the whole store.
  { id: 'staff_new_order', group: 'you', trigger: 'auto', channels: BOTH },
  { id: 'staff_daily_summary', group: 'you', trigger: 'auto', channels: BOTH },
  { id: 'contact_message', group: 'app', trigger: 'app', channels: EMAIL, appId: 'forms' },
  { id: 'review_request', group: 'app', trigger: 'app', channels: EMAIL, appId: 'reviews' },
  { id: 'review_reminder', group: 'app', trigger: 'app', channels: EMAIL, appId: 'reviews' },
  { id: 'review_reply', group: 'app', trigger: 'app', channels: EMAIL, appId: 'reviews' },
  { id: 'affiliate_update', group: 'app', trigger: 'app', channels: EMAIL, appId: 'affiliates' },
]

export const messageDef = (id: string): MessageDef | undefined =>
  MESSAGE_CATALOGUE.find((m) => m.id === id)

/** Only messages the platform sends on its own can be switched off. */
export const messageSwitchable = (id: string): boolean => messageDef(id)?.trigger === 'auto'

/** Whether the store sends this message. Everything is on until the merchant turns it off. */
export function isMessageOn(settings: Pick<NotificationSettings, 'off'>, id: string): boolean {
  return !(messageSwitchable(id) && settings.off.includes(id))
}

/** The `off` list after switching one message on or off; ignores messages that cannot be switched. */
export function withMessage(
  settings: Pick<NotificationSettings, 'off'>,
  id: string,
  on: boolean,
): string[] {
  if (!messageSwitchable(id)) return settings.off
  const rest = settings.off.filter((x) => x !== id)
  return on ? rest : [...rest, id]
}
