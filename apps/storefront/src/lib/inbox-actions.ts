'use server'

import 'server-only'

import { loadEnv, settingsSecret } from '@commerce/config'
import { createRedisRateLimitStore } from '@commerce/core'
import {
  contactRequired,
  enqueueInboxAiReply,
  featuredProducts,
  findShopperConversation,
  InboxError,
  InboxRateLimited,
  inboxState,
  isInboxAvailable,
  markShopperSeen,
  messageCards,
  messageEvents,
  publishInboxEvents,
  type ShopperMessage,
  seenEvents,
  shopperMessageOf,
  shopperSend,
  shopperThread,
  typingEvent,
} from '@commerce/core/inbox/server'
import { inboxAiQueue, sharedRedis } from '@commerce/queue'
import { headers } from 'next/headers'
import { currentCustomer } from './customer-session'
import { chatIdentity, chatIdentityForSend, chatPublisher, openChatPhotoToken } from './inbox'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/*
 * The Inbox chat's server actions. The store is always the one the hostname resolved to; the
 * shopper is their `wc_chat` cookie or session, never anything in the arguments. Realtime
 * events go out after the write's transaction has committed.
 */

const TYPING_RULE = { limit: 1, windowMs: 3000 }
const STATE_RULE = { limit: 60, windowMs: 60_000 }

const limiter = () => createRedisRateLimitStore(sharedRedis(loadEnv(process.env).REDIS_URL))

/** What the widget needs to draw: settings, who is online, the thread and the featured products. */
export async function chatStateAction() {
  const storeId = await requestStoreId()
  const ip = clientIp(await headers())
  if (!(await rateLimited('inbox-state:ip', `${storeId}:${ip}`, STATE_RULE)).ok) return null
  const who = await chatIdentity(storeId)
  const me = await currentCustomer(storeId)
  return inStore(storeId, async (tx) => {
    const state = await inboxState(tx, storeId)
    if (!state.installed || !state.settings.widget.enabled) return null
    const available = isInboxAvailable(state.settings, state.timeZone)
    const thread = who ? await shopperThread({ storeId, tx }, who) : null
    const cards = thread ? await messageCards(tx, thread.messages) : { products: {}, discounts: {} }
    const featured = state.settings.widget.showFeaturedProducts
      ? await featuredProducts(tx, state.settings.widget.featuredProductIds)
      : []
    return {
      storeName: state.storeName,
      greeting: state.settings.greeting,
      awayMessage: state.settings.awayMessage,
      available,
      askContact: state.settings.contactCapture !== 'off',
      contactRequired: contactRequired(state.settings, available),
      requireSignIn: state.settings.requireSignIn,
      sound: state.settings.sound,
      signedIn: Boolean(me),
      thread,
      cards,
      featured,
    }
  })
}

export type ChatState = NonNullable<Awaited<ReturnType<typeof chatStateAction>>>

export type ChatSendInput = {
  body?: string
  clientId: string
  /** From the photo upload (`/inbox/photo`), signed for this store. */
  photoToken?: string
  name?: string
  email?: string
  phone?: string
  url?: string
  /** The hidden field a person never fills. */
  website?: string
}

export type ChatSendResult =
  | { ok: true; message: ShopperMessage; conversationId: string }
  | { ok: false; error: 'sign_in' | 'blocked' | 'busy' | 'invalid' | 'failed' }

/** Queues the AI agent's look at a new shopper message; a queue outage never fails the send. */
async function queueAiReply(storeId: string, conversationId: string, messageId: string) {
  try {
    await enqueueInboxAiReply(inboxAiQueue(loadEnv(process.env).REDIS_URL), {
      storeId,
      conversationId,
      messageId,
    })
  } catch {
    // The staff inbox still has the message; the AI just skips it.
  }
}

/** Sends the shopper's message (text or a photo), starting their conversation if needed. */
export async function sendChatAction(input: ChatSendInput): Promise<ChatSendResult> {
  const storeId = await requestStoreId()
  // A bot that fills the hidden field is told "sent" and nothing is stored.
  if (input.website?.trim()) return { ok: false, error: 'invalid' }
  const who = await chatIdentityForSend(storeId)
  const mediaId = input.photoToken ? openChatPhotoToken(storeId, input.photoToken) : null
  if (input.photoToken && !mediaId) return { ok: false, error: 'invalid' }
  const ip = clientIp(await headers())
  try {
    const sent = await inStore(storeId, async (tx) => {
      const state = await inboxState(tx, storeId)
      if (!state.installed) throw new InboxError('INBOX_NOT_INSTALLED', 'Inbox is off', storeId)
      return shopperSend(
        { storeId, tx },
        who,
        {
          kind: mediaId ? 'image' : 'text',
          body: input.body ?? '',
          ...(mediaId ? { mediaId } : {}),
          clientId: input.clientId,
          ...(input.name ? { name: input.name } : {}),
          ...(input.email ? { email: input.email } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.url ? { url: input.url.slice(0, 500) } : {}),
        },
        { secret: settingsSecret(), settings: state.settings, ip, limiter: limiter() },
      )
    })
    if (sent.created) {
      await publishInboxEvents(
        chatPublisher(),
        messageEvents(storeId, sent.conversation, sent.message),
      )
      // The AI agent decides in the worker whether it answers (mode, staff online, take-over).
      if (!sent.spam) await queueAiReply(storeId, sent.conversation.id, sent.message.id)
    }
    return {
      ok: true,
      conversationId: sent.conversation.id,
      message: shopperMessageOf(sent.message),
    }
  } catch (err) {
    if (err instanceof InboxRateLimited) return { ok: false, error: 'busy' }
    if (err instanceof InboxError) {
      if (err.code === 'INBOX_SIGN_IN_REQUIRED') return { ok: false, error: 'sign_in' }
      if (err.code === 'INBOX_BLOCKED') return { ok: false, error: 'blocked' }
      return { ok: false, error: 'invalid' }
    }
    return { ok: false, error: 'failed' }
  }
}

/** The shopper opened the chat: staff replies so far are seen. */
export async function chatSeenAction(): Promise<void> {
  const storeId = await requestStoreId()
  const who = await chatIdentity(storeId)
  if (!who) return
  const seen = await inStore(storeId, async (tx) => {
    const thread = await shopperThread({ storeId, tx }, who)
    if (!thread) return null
    const ok = await markShopperSeen({ storeId, tx }, who, thread.conversation.id)
    return ok ? { id: thread.conversation.id, last: thread.messages.at(-1)?.id ?? null } : null
  })
  if (seen) {
    await publishInboxEvents(chatPublisher(), seenEvents(storeId, seen.id, 'shopper', seen.last))
  }
}

/** "Typing…" to staff; never stored, at most one every 3 seconds. */
export async function chatTypingAction(conversationId: string): Promise<void> {
  const storeId = await requestStoreId()
  const who = await chatIdentity(storeId)
  if (!who || !/^[0-9a-f-]{36}$/i.test(conversationId)) return
  const limit = await rateLimited('inbox-typing', `${storeId}:${conversationId}`, TYPING_RULE)
  if (!limit.ok) return
  const mine = await inStore(storeId, (tx) => findShopperConversation(tx, who))
  if (mine?.id !== conversationId) return
  await publishInboxEvents(chatPublisher(), [typingEvent(storeId, conversationId, 'shopper')])
}

/** Product and code cards for messages the widget received live. */
export async function chatCardsAction(messages: { kind: string; payload: unknown }[]) {
  const storeId = await requestStoreId()
  return inStore(storeId, (tx) => messageCards(tx, messages.slice(0, 50)))
}
