import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { loadEnv, settingsSecret } from '@commerce/config'
import {
  CHAT_COOKIE,
  CHAT_COOKIE_MAX_AGE,
  findShopperConversation,
  hashChatToken,
  inboxChannels,
  inboxState,
  inboxStreamResponse,
  mergeGuestConversation,
  messageEvents,
  newChatToken,
  type PubSubPublisher,
  postCartEvent,
  publishInboxEvents,
  replayFloorId,
  type ShopperIdentity,
  shopperReplay,
  shopperThread,
} from '@commerce/core/inbox/server'
import { inboxHub, inboxPublisher } from '@commerce/queue'
import { cookies, headers } from 'next/headers'
import { currentCustomer } from './customer-session'
import { inStore } from './store-context'

/*
 * The Inbox widget's read side on the storefront: who the shopper is (the `wc_chat` guest
 * cookie, stored only as a hash, and the signed-in customer), their live stream, the polling
 * fallback, the chat cookie, signed photo tokens and the publisher the chat actions use.
 * Design: docs/superpowers/specs/2026-10-24-inbox-design.md §4, §5.
 */

/**
 * The shopper asking, or null when they have neither a chat cookie nor a session. A shopper
 * who signed in on a browser that chatted as a guest has that guest thread joined to their
 * customer record here, whichever way they signed in (it is a no-op once done).
 */
export async function chatIdentity(storeId: string): Promise<ShopperIdentity | null> {
  const token = (await cookies()).get(CHAT_COOKIE)?.value
  const visitorKeyHash = token ? hashChatToken(token) : null
  const customer = await currentCustomer(storeId)
  if (!visitorKeyHash && !customer) return null
  if (visitorKeyHash && customer) {
    await inStore(storeId, (tx) =>
      mergeGuestConversation({ storeId, tx }, { visitorKeyHash, customerId: customer.id }),
    )
  }
  return { customerId: customer?.id ?? null, visitorKeyHash }
}

/**
 * The identity to send with, minting the `wc_chat` cookie on the first message (never on
 * open, so a shopper who only looks gets no cookie). Signed-in shoppers get one too, so a
 * cart change can check the cookie before any query.
 */
export async function chatIdentityForSend(storeId: string): Promise<ShopperIdentity> {
  const jar = await cookies()
  let token = jar.get(CHAT_COOKIE)?.value
  if (!token || !hashChatToken(token)) {
    token = newChatToken()
    const proto = (await headers()).get('x-forwarded-proto')
    jar.set(CHAT_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: proto === 'https' || process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CHAT_COOKIE_MAX_AGE,
    })
  }
  const known = await chatIdentity(storeId)
  return { customerId: known?.customerId ?? null, visitorKeyHash: hashChatToken(token) }
}

/** True when this browser has chatted (the cheap check before a cart line is posted). */
export async function hasChatCookie(): Promise<boolean> {
  return Boolean((await cookies()).get(CHAT_COOKIE)?.value)
}

/** The publisher for realtime events, or undefined without Redis (clients then poll). */
export function chatPublisher(): PubSubPublisher | undefined {
  try {
    return inboxPublisher(loadEnv(process.env).REDIS_URL)
  } catch {
    return undefined
  }
}

const photoSig = (storeId: string, mediaId: string) =>
  createHmac('sha256', settingsSecret())
    .update(`inbox-photo:${storeId}:${mediaId}`)
    .digest('base64url')

/** A token for a photo this browser uploaded, so a message can only attach its own uploads. */
export const chatPhotoToken = (storeId: string, mediaId: string) =>
  `${mediaId}.${photoSig(storeId, mediaId)}`

/** The media id inside a valid photo token, or null. */
export function openChatPhotoToken(storeId: string, token: string): string | null {
  const [mediaId, sig] = token.split('.')
  if (!mediaId || !sig || !/^[0-9a-f-]{36}$/i.test(mediaId)) return null
  const want = Buffer.from(photoSig(storeId, mediaId))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got) ? mediaId : null
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

/**
 * A cart change as a line in the shopper's open conversation, with the cart id so the staff
 * panel shows the live cart. Costs no query unless this browser has chatted.
 */
export async function postChatCartLine(
  storeId: string,
  event: {
    action: 'add' | 'remove' | 'quantity'
    variantId: string
    title: string
    quantity: number
    cartId: string
  },
): Promise<void> {
  if (!(await hasChatCookie())) return
  try {
    const who = await chatIdentity(storeId)
    if (!who) return
    const posted = await inStore(storeId, async (tx) => {
      const message = await postCartEvent({ storeId, tx }, who, event)
      if (!message) return null
      const conversation = await findShopperConversation(tx, who)
      return conversation ? { message, conversation } : null
    })
    if (posted) {
      await publishInboxEvents(
        chatPublisher(),
        messageEvents(storeId, posted.conversation, posted.message),
      )
    }
  } catch {
    // A cart change never fails because the chat line could not be written.
  }
}
