/** SOURCE OF TRUTH: staff push wording — WHAT: turns one outbox row (new order, shopper message, approval waiting, stock out, a payment or app problem) into the push a team member sees: its alert, title, one line, the admin page it opens, and who may get it / WHY: one place decides what each event says and which role may hear it, so the worker only has to send */

import {
  aiAction,
  inboxConversation,
  inboxMessage,
  order,
  outboxEvent,
  product,
  type StoreTx,
  variant,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { eq } from 'drizzle-orm'
import { previewOf } from '../inbox/rules'
import type { PushAlert } from '../member-account/alert-prefs'
import type { OutboxPayload } from '../outbox/types'
import { gatewayName } from '../payments/gateway-health'
import { type Permission, permissions } from '../permissions/statement'

/** Who may get a push, before their own alert switches are checked. */
export type PushAudience =
  /** Every active member whose role holds the permission (the owner always does). */
  | { kind: 'role'; permission: Permission }
  /** Only these members, if their role holds the permission (null: no check, it is their own). */
  | { kind: 'members'; userIds: string[]; permission: Permission | null }
  /** Whoever may approve a change held back by `permission` (null: any approver), never the asker. */
  | { kind: 'approvers'; permission: Permission | null; askerId: string }

export type PushMessage = {
  alert: PushAlert
  title: string
  body: string
  /** Admin path the notification opens, starting with `/`. */
  url: string
  /** Same tag replaces the earlier notification on the device (one per conversation, order…). */
  tag: string
  audience: PushAudience
}

/** Longest line a phone shows without cutting it badly. */
const BODY_MAX = 140

const line = (text: string) =>
  text.length > BODY_MAX ? `${text.slice(0, BODY_MAX - 1).trimEnd()}…` : text

const PLATFORM_NAMES: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
  openai: 'ChatGPT',
  whatsapp: 'WhatsApp',
}

const platformName = (p: string | undefined) => (p ? (PLATFORM_NAMES[p] ?? p) : 'A sales channel')

/** The sales-channel page a platform's problem is fixed on. */
const channelPage = (p: string | undefined) =>
  p === 'meta' || p === 'whatsapp' ? '/sales-channels/social' : '/sales-channels/agentic'

/** Non-text Inbox messages, as the list shows them. */
const MESSAGE_KINDS: Record<string, string> = {
  product: 'Sent a product',
  image: 'Sent a photo',
  cart_event: 'Updated their cart',
  discount: 'Sent a discount',
}

async function newOrder(tx: StoreTx, payload: OutboxPayload): Promise<PushMessage | null> {
  if (!payload.orderId) return null
  const [o] = await tx
    .select({ number: order.number, totalPaise: order.totalPaise, isTest: order.isTest })
    .from(order)
    .where(eq(order.id, payload.orderId))
  if (!o || o.isTest) return null
  return {
    alert: 'newOrder',
    title: `New order #${o.number}`,
    body: formatMoney(Number(o.totalPaise)),
    url: `/orders/${encodeURIComponent(payload.orderId)}`,
    tag: `order-${payload.orderId}`,
    audience: { kind: 'role', permission: permissions.ORDERS_READ },
  }
}

async function inboxMessageReceived(
  tx: StoreTx,
  payload: OutboxPayload,
): Promise<PushMessage | null> {
  if (!payload.conversationId || !payload.messageId) return null
  const [c] = await tx
    .select({
      contactName: inboxConversation.contactName,
      assigneeUserId: inboxConversation.assigneeUserId,
      status: inboxConversation.status,
    })
    .from(inboxConversation)
    .where(eq(inboxConversation.id, payload.conversationId))
  const [m] = await tx
    .select({ body: inboxMessage.body, kind: inboxMessage.kind })
    .from(inboxMessage)
    .where(eq(inboxMessage.id, payload.messageId))
  if (!c || !m || c.status === 'blocked') return null
  const text = m.body.trim() ? previewOf(m.body) : (MESSAGE_KINDS[m.kind] ?? 'Sent a message')
  const conversationId = payload.conversationId
  return {
    alert: 'inboxMessage',
    title: c.contactName?.trim() || 'New message',
    body: line(text),
    url: `/sales-channels/inbox/conversations?id=${encodeURIComponent(conversationId)}`,
    tag: `inbox-${conversationId}`,
    // An assigned conversation is its assignee's; an open one, the whole Inbox team's.
    audience: c.assigneeUserId
      ? { kind: 'members', userIds: [c.assigneeUserId], permission: permissions.INBOX_READ }
      : { kind: 'role', permission: permissions.INBOX_READ },
  }
}

async function approvalRequested(tx: StoreTx, payload: OutboxPayload): Promise<PushMessage | null> {
  if (!payload.actionId) return null
  const [a] = await tx
    .select({
      userId: aiAction.userId,
      status: aiAction.status,
      summary: aiAction.summary,
      needsApprover: aiAction.needsApprover,
      permission: aiAction.permission,
      source: aiAction.source,
    })
    .from(aiAction)
    .where(eq(aiAction.id, payload.actionId))
  // Decided (or withdrawn) before the push went: nothing waits any more.
  if (a?.status !== 'proposed') return null
  const base = {
    alert: 'approvalWaiting' as const,
    body: line(a.summary),
    url: '/settings/approvals',
    tag: `approval-${payload.actionId}`,
  }
  if (a.needsApprover) {
    return {
      ...base,
      title: 'Approval waiting',
      audience: {
        kind: 'approvers',
        permission: (a.permission as Permission | null) ?? null,
        askerId: a.userId,
      },
    }
  }
  // An AI app's (MCP) request waits for its own member to confirm it.
  if (a.source !== 'mcp') return null
  return {
    ...base,
    title: 'Your AI app is asking to make a change',
    audience: { kind: 'members', userIds: [a.userId], permission: null },
  }
}

async function outOfStock(tx: StoreTx, payload: OutboxPayload): Promise<PushMessage | null> {
  if (!payload.productId) return null
  const [p] = await tx
    .select({ title: product.title })
    .from(product)
    .where(eq(product.id, payload.productId))
  if (!p) return null
  const [v] = payload.variantId
    ? await tx
        .select({ title: variant.title })
        .from(variant)
        .where(eq(variant.id, payload.variantId))
    : []
  const name = v?.title && v.title !== 'Default Title' ? `${p.title} (${v.title})` : p.title
  return {
    alert: 'lowStock',
    title: 'Out of stock',
    body: line(`${name} just sold out.`),
    url: `/products/${encodeURIComponent(payload.productId)}`,
    tag: `stock-${payload.variantId ?? payload.productId}`,
    audience: { kind: 'role', permission: permissions.INVENTORY_READ },
  }
}

/** The push for one outbox row; null when the row is not one staff get a push for. */
export async function pushMessageForRow(
  tx: StoreTx,
  outboxId: string,
): Promise<PushMessage | null> {
  const [row] = await tx.select().from(outboxEvent).where(eq(outboxEvent.id, outboxId))
  if (!row) return null
  const payload = row.payload as OutboxPayload
  switch (row.type) {
    case 'order.placed':
      return newOrder(tx, payload)
    case 'inbox.message_received':
      return inboxMessageReceived(tx, payload)
    case 'approval.requested':
      return approvalRequested(tx, payload)
    case 'inventory.out':
      return outOfStock(tx, payload)
    case 'payments.gateway_keys_refused': {
      const name = gatewayName(payload.gatewayAlert?.gateway ?? 'payment gateway')
      return {
        alert: 'paymentProblem',
        title: `${name} rejected your API keys`,
        body: `Checkout hides ${name} until you save working keys again.`,
        url: '/settings/payments',
        tag: `gateway-${payload.gatewayAlert?.gateway ?? 'unknown'}`,
        audience: { kind: 'role', permission: permissions.PAYMENTS_MANAGE },
      }
    }
    case 'channel.sync_failed':
      return {
        alert: 'appErrors',
        title: `${platformName(payload.platform)} catalog sync failed`,
        body: line(
          payload.message?.trim() || 'Your products did not update there. Open it to see why.',
        ),
        url: channelPage(payload.platform),
        tag: `channel-${payload.platform ?? 'unknown'}`,
        audience: { kind: 'role', permission: permissions.SETTINGS_READ },
      }
    case 'meta.access_removed':
      return {
        alert: 'appErrors',
        title: 'Meta access ended',
        body: 'Facebook and Instagram stopped working with your store. Connect them again.',
        url: '/sales-channels/social',
        tag: 'meta-access',
        audience: { kind: 'role', permission: permissions.SETTINGS_READ },
      }
    case 'pixel.connection_failed':
      return {
        alert: 'appErrors',
        title: 'Meta pixel stopped working',
        body: 'Meta stopped accepting your pixel token, so ad sales are not being counted.',
        url: '/apps',
        tag: `pixel-${payload.externalId ?? 'unknown'}`,
        audience: { kind: 'role', permission: permissions.SETTINGS_READ },
      }
    default:
      return null
  }
}

/** "Send a test": the member's own devices, whatever their switches say. */
export const TEST_PUSH = {
  title: 'Push notifications are on',
  body: 'This is a test. New orders, messages and approvals will show up like this.',
  url: '/account/notifications',
  tag: 'push-test',
} as const
