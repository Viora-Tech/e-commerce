import 'server-only'
import { loadEnv } from '@commerce/config'
import {
  CHAT_COOKIE,
  findShopperConversation,
  hashChatToken,
  inboxChannels,
  inboxState,
  inboxStreamResponse,
  replayFloorId,
  type ShopperIdentity,
  shopperReplay,
  shopperThread,
} from '@commerce/core/inbox/server'
import { inboxHub } from '@commerce/queue'
import { cookies } from 'next/headers'
import { currentCustomer } from './customer-session'
import { inStore } from './store-context'

/*
 * The Inbox widget's read side on the storefront: who the shopper is (the `wc_chat` guest
 * cookie, stored only as a hash, and the signed-in customer), their live stream and the
 * polling fallback. Writes (send, upload, seen) arrive with the widget (Inbox PR 5).
 * Design: docs/superpowers/specs/2026-10-24-inbox-design.md §4, §5.
 */

/** The shopper asking, or null when they have neither a chat cookie nor a session. */
export async function chatIdentity(storeId: string): Promise<ShopperIdentity | null> {
  const token = (await cookies()).get(CHAT_COOKIE)?.value
  const visitorKeyHash = token ? hashChatToken(token) : null
  const customer = await currentCustomer(storeId)
  if (!visitorKeyHash && !customer) return null
  return { customerId: customer?.id ?? null, visitorKeyHash }
}

function hubOrNull() {
  try {
    return inboxHub(loadEnv(process.env).REDIS_URL)
  } catch {
    return null
  }
}

/** The shopper's live stream: their conversation's channel only, never staff notes. */
export async function shopperStream(storeId: string, request: Request): Promise<Response> {
  const who = await chatIdentity(storeId)
  if (!who) return new Response('Not found', { status: 404 })
  const found = await inStore(storeId, async (tx) => {
    if (!(await inboxState(tx, storeId)).installed) return null
    return findShopperConversation(tx, who)
  })
  if (!found) return new Response('Not found', { status: 404 })
  const id = found.id
  return inboxStreamResponse({
    hub: hubOrNull(),
    channels: [inboxChannels.conversation(id)],
    lastEventId:
      request.headers.get('last-event-id') ?? new URL(request.url).searchParams.get('after'),
    replay: (floorId) => inStore(storeId, (tx) => shopperReplay(tx, id, floorId)),
    accept: (event) => event.conversationId === id,
    signal: request.signal,
  })
}

/**
 * The widget's polling fallback (every 4 s while open): messages after `after` (5 s early,
 * the widget drops repeats by id) and the thread's unread and seen marks.
 */
export async function shopperPoll(storeId: string, after: string | null) {
  const who = await chatIdentity(storeId)
  if (!who) return { events: [], unread: 0 }
  const thread = await inStore(storeId, (tx) =>
    shopperThread({ storeId, tx }, who, { afterId: replayFloorId(after) }),
  )
  if (!thread) return { events: [], unread: 0 }
  const { conversation } = thread
  return {
    events: [
      ...thread.messages.map((message) => ({
        type: 'message',
        conversationId: conversation.id,
        message,
      })),
      {
        type: 'seen',
        conversationId: conversation.id,
        by: 'staff',
        messageId: conversation.staffSeenMessageId,
      },
    ],
    unread: conversation.unreadShopper,
  }
}
