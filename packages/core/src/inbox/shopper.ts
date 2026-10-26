/** SOURCE OF TRUTH: findShopperConversation, shopperThread, shopperSend, markShopperSeen, mergeGuestConversation, postCartEvent — WHAT: the storefront side of Inbox: a guest (chat cookie) or a signed-in customer finds their thread, sends text or an image, marks staff replies seen, and their guest thread joins their customer record on sign-in; cart changes post a line into an open thread / WHY: the widget's server actions and stream route call only these, so the access rule (`canShopperAccess`), blocks, spam and rate limits are applied in one place (design §5, §7). */
import { customer, inboxConversation, inboxMessage, media, type StoreTx } from '@commerce/db'
import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import type { RateLimitStore } from '../rate-limit/limiter'
import { isSenderBlocked } from './blocks'
import { MESSAGE_MAX, SHOPPER_MESSAGE_KINDS } from './constants'
import { encryptContactPhone, inboxHash } from './identity'
import { cleanPagePath } from './insights'
import { checkInboxLimits, type InboxLimit, shopperMessageChecks } from './limits'
import {
  appendMessage,
  type InboxConversationRow,
  InboxError,
  type InboxMessageRow,
  messagesAfter,
} from './messages'
import { canShopperAccess, isFirstMessageSpam, type ShopperIdentity, sameText } from './rules'
import type { InboxSettings } from './settings'

/** What the widget sees of a message: never staff notes, never who on the staff wrote it. */
export type ShopperMessage = {
  id: string
  sender: InboxMessageRow['sender']
  kind: InboxMessageRow['kind']
  body: string
  payload: Record<string, unknown> | null
  clientId: string | null
  createdAt: Date
}

export const shopperMessageOf = (m: InboxMessageRow): ShopperMessage => ({
  id: m.id,
  sender: m.sender,
  kind: m.kind,
  body: m.body,
  payload: m.payload ?? null,
  clientId: m.clientId,
  createdAt: m.createdAt,
})

export type ShopperConversation = {
  id: string
  status: InboxConversationRow['status']
  unreadShopper: number
  /** The last of the shopper's messages staff have seen (the "Seen" mark). */
  staffSeenMessageId: string | null
  hasContact: boolean
}

const conversationOf = (c: InboxConversationRow): ShopperConversation => ({
  id: c.id,
  status: c.status,
  unreadShopper: c.unreadShopper,
  staffSeenMessageId: c.staffSeenMessageId,
  hasContact: Boolean(c.contactEmail || c.contactPhone || c.customerId),
})

/** Whose threads match: the customer's when signed in, the guest cookie's otherwise. */
function ownerFilter(who: ShopperIdentity) {
  if (who.customerId) return eq(inboxConversation.customerId, who.customerId)
  if (who.visitorKeyHash) {
    return and(
      eq(inboxConversation.visitorKeyHash, who.visitorKeyHash),
      isNull(inboxConversation.customerId),
    )
  }
  return undefined
}

/** The shopper's latest conversation (any status), or null. */
export async function findShopperConversation(
  tx: StoreTx,
  who: ShopperIdentity,
): Promise<InboxConversationRow | null> {
  const owner = ownerFilter(who)
  if (!owner) return null
  const [row] = await tx
    .select()
    .from(inboxConversation)
    .where(owner)
    .orderBy(desc(inboxConversation.lastMessageAt), desc(inboxConversation.id))
    .limit(1)
  return row && canShopperAccess(row, who) ? row : null
}

/**
 * The shopper's thread: everything after `afterId` (replay and polling), or the latest 200.
 * Null when the shopper has none, or `conversationId` is not theirs.
 */
export async function shopperThread(
  ctx: StoreContext,
  who: ShopperIdentity,
  opts: { conversationId?: string | null; afterId?: string | null } = {},
): Promise<{ conversation: ShopperConversation; messages: ShopperMessage[] } | null> {
  let conversation: InboxConversationRow | null
  if (opts.conversationId) {
    const [row] = await ctx.tx
      .select()
      .from(inboxConversation)
      .where(eq(inboxConversation.id, opts.conversationId))
    conversation = row && canShopperAccess(row, who) ? row : null
  } else {
    conversation = await findShopperConversation(ctx.tx, who)
  }
  if (!conversation) return null
  const messages = await messagesAfter(ctx.tx, conversation.id, opts.afterId ?? null, {
    includeNotes: false,
  })
  return { conversation: conversationOf(conversation), messages: messages.map(shopperMessageOf) }
}

export const ShopperSendSchema = z.object({
  kind: z.enum(SHOPPER_MESSAGE_KINDS).default('text'),
  body: z.string().max(MESSAGE_MAX).default(''),
  mediaId: z.uuid().optional(),
  clientId: z.string().min(8).max(64),
  name: z.string().trim().max(80).optional(),
  email: z.email().max(200).optional(),
  phone: z.string().trim().max(20).optional(),
  /** The page the shopper wrote from: starts the chat's `startedUrl`, and each text message keeps its own. */
  url: z.string().max(500).optional(),
})
export type ShopperSendInput = z.input<typeof ShopperSendSchema>

export class InboxRateLimited extends InboxError {
  readonly rule: InboxLimit
  readonly retryAfterMs: number
  constructor(rule: InboxLimit, retryAfterMs: number, storeId: string) {
    super('INBOX_RATE_LIMITED', 'Too many messages. Wait a moment and try again.', storeId)
    this.rule = rule
    this.retryAfterMs = retryAfterMs
  }
}

/** How many other conversations from this IP started with the same text. */
async function sameTextFromIp(tx: StoreTx, ipHash: string, body: string): Promise<number> {
  const text = sameText(body)
  if (!text) return 0
  const [row] = await tx
    .select({ n: sql<number>`count(distinct ${inboxMessage.conversationId})::int` })
    .from(inboxMessage)
    .innerJoin(inboxConversation, eq(inboxConversation.id, inboxMessage.conversationId))
    .where(
      and(
        eq(inboxConversation.ipHash, ipHash),
        eq(inboxMessage.sender, 'shopper'),
        sql`lower(regexp_replace(btrim(${inboxMessage.body}), '\\s+', ' ', 'g')) = ${text}`,
      ),
    )
  return row?.n ?? 0
}

type SendOpts = {
  secret: string
  settings: Pick<InboxSettings, 'requireSignIn'>
  /** The shopper's IP as the trusted proxy reports it. */
  ip: string
  /** Absent in tests that do not exercise limits. */
  limiter?: RateLimitStore | undefined
  now?: Date
}

/**
 * A shopper's message. Starts their conversation when they have none, reopens a closed one,
 * and refuses when they are blocked, over a rate limit, or sign-in is required. A guest's
 * first message that looks like spam starts the conversation in Blocked (reason spam): it is
 * stored, so staff can unblock it, but nobody is notified (`spam: true`).
 */
export async function shopperSend(
  ctx: StoreContext,
  who: ShopperIdentity,
  raw: ShopperSendInput,
  opts: SendOpts,
): Promise<{
  conversation: InboxConversationRow
  message: InboxMessageRow
  created: boolean
  started: boolean
  spam: boolean
}> {
  const input = ShopperSendSchema.parse(raw)
  const now = opts.now ?? new Date()
  if (!who.customerId && !who.visitorKeyHash) {
    throw new InboxError('INBOX_INVALID', 'No chat session', ctx.storeId)
  }
  if (opts.settings.requireSignIn && !who.customerId) {
    throw new InboxError('INBOX_SIGN_IN_REQUIRED', 'Sign in to chat with us', ctx.storeId)
  }
  const body = input.body.trim()
  let payload: Record<string, unknown> | null = null
  if (input.kind === 'image') {
    const [m] = input.mediaId
      ? await ctx.tx
          .select({ id: media.id, url: media.url })
          .from(media)
          .where(eq(media.id, input.mediaId))
      : []
    if (!m) throw new InboxError('INBOX_INVALID', 'Image not found', ctx.storeId)
    payload = { mediaId: m.id, url: m.url }
  } else if (!body) {
    throw new InboxError('INBOX_INVALID', 'Write a message', ctx.storeId)
  } else {
    // The page they wrote from: the panel's "Pages viewed" and the product they are on.
    const page = cleanPagePath(input.url)
    if (page) payload = { page }
  }

  const ipHash = inboxHash('ip', opts.ip, opts.secret)
  const emailHash = input.email ? inboxHash('email', input.email, opts.secret) : null
  let conversation = await findShopperConversation(ctx.tx, who)
  if (conversation?.status === 'blocked') {
    throw new InboxError('INBOX_BLOCKED', 'This chat is closed', ctx.storeId)
  }
  if (
    await isSenderBlocked(ctx.tx, { visitorKeyHash: who.visitorKeyHash, emailHash, ipHash }, now)
  ) {
    throw new InboxError('INBOX_BLOCKED', 'This chat is closed', ctx.storeId)
  }
  if (opts.limiter) {
    const limit = await checkInboxLimits(
      opts.limiter,
      ctx.storeId,
      shopperMessageChecks({ conversationId: conversation?.id ?? null, ipHash, kind: input.kind }),
      now.getTime(),
    )
    if (!limit.ok) throw new InboxRateLimited(limit.rule, limit.result.retryAfterMs, ctx.storeId)
  }

  const phone = input.phone ? encryptContactPhone(input.phone, opts.secret) : null
  const contact = {
    ...(input.name ? { contactName: input.name } : {}),
    ...(input.email ? { contactEmail: input.email.toLowerCase() } : {}),
    ...(phone ? { contactPhone: phone.cipher, contactPhoneIndex: phone.index } : {}),
  }
  let started = false
  let spam = false
  if (!conversation) {
    spam = !who.customerId && isFirstMessageSpam(body, await sameTextFromIp(ctx.tx, ipHash, body))
    const [row] = await ctx.tx
      .insert(inboxConversation)
      .values({
        storeId: ctx.storeId,
        customerId: who.customerId,
        visitorKeyHash: who.visitorKeyHash,
        contactVerified: Boolean(who.customerId),
        status: spam ? 'blocked' : 'open',
        blockedReason: spam ? 'spam' : null,
        startedUrl: input.url ?? null,
        ipHash,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
        ...contact,
      })
      .onConflictDoNothing()
      .returning()
    // Two first messages raced from one browser: use the thread the other one opened.
    conversation = row ?? (await findShopperConversation(ctx.tx, who))
    if (!conversation) throw new InboxError('INBOX_INVALID', 'Chat could not start', ctx.storeId)
    started = Boolean(row)
  } else {
    const patch: Partial<typeof inboxConversation.$inferInsert> = {}
    if (conversation.status === 'closed')
      Object.assign(patch, { status: 'open', closedAt: null, closedBy: null })
    if (input.name && !conversation.contactName) patch.contactName = contact.contactName
    if (input.email && !conversation.contactEmail) patch.contactEmail = contact.contactEmail
    if (phone && !conversation.contactPhone) {
      Object.assign(patch, { contactPhone: phone.cipher, contactPhoneIndex: phone.index })
    }
    if (Object.keys(patch).length > 0) {
      await ctx.tx
        .update(inboxConversation)
        .set(patch)
        .where(eq(inboxConversation.id, conversation.id))
    }
  }
  const current = conversation as InboxConversationRow
  const { message, created } = await appendMessage(
    ctx.tx,
    ctx.storeId,
    current,
    { sender: 'shopper', kind: input.kind, body, payload, clientId: input.clientId },
    now,
  )
  const [fresh] = await ctx.tx
    .select()
    .from(inboxConversation)
    .where(eq(inboxConversation.id, current.id))
  return { conversation: fresh ?? current, message, created, started, spam }
}

/** The shopper opened the widget: staff replies so far are seen. */
export async function markShopperSeen(
  ctx: StoreContext,
  who: ShopperIdentity,
  conversationId: string,
): Promise<boolean> {
  const [row] = await ctx.tx
    .select()
    .from(inboxConversation)
    .where(eq(inboxConversation.id, conversationId))
  if (!row || !canShopperAccess(row, who)) return false
  const [last] = await ctx.tx
    .select({ id: inboxMessage.id })
    .from(inboxMessage)
    .where(and(eq(inboxMessage.conversationId, conversationId), ne(inboxMessage.kind, 'note')))
    .orderBy(desc(inboxMessage.id))
    .limit(1)
  await ctx.tx
    .update(inboxConversation)
    .set({ unreadShopper: 0, shopperSeenMessageId: last?.id ?? null })
    .where(eq(inboxConversation.id, conversationId))
  return true
}

/**
 * The shopper signed in. Their guest threads join their customer record (verified from now
 * on). If the customer already has an open thread, the guest's open thread's messages move
 * into it under a "Messages from before you signed in" line and the empty guest thread goes.
 */
export async function mergeGuestConversation(
  ctx: StoreContext,
  input: { visitorKeyHash: string; customerId: string },
): Promise<{ merged: number; movedInto: string | null }> {
  const guest = await ctx.tx
    .select()
    .from(inboxConversation)
    .where(
      and(
        eq(inboxConversation.visitorKeyHash, input.visitorKeyHash),
        isNull(inboxConversation.customerId),
        ne(inboxConversation.status, 'blocked'),
      ),
    )
  if (guest.length === 0) return { merged: 0, movedInto: null }
  const [c] = await ctx.tx
    .select({ email: customer.email, name: customer.name })
    .from(customer)
    .where(eq(customer.id, input.customerId))
  if (!c) return { merged: 0, movedInto: null }
  const [target] = await ctx.tx
    .select()
    .from(inboxConversation)
    .where(
      and(eq(inboxConversation.customerId, input.customerId), eq(inboxConversation.status, 'open')),
    )
    .orderBy(desc(inboxConversation.lastMessageAt))
    .limit(1)
  const openGuest = guest.find((g) => g.status === 'open')
  let movedInto: string | null = null
  if (target && openGuest) {
    const moved = await ctx.tx
      .select({ id: inboxMessage.id })
      .from(inboxMessage)
      .where(eq(inboxMessage.conversationId, openGuest.id))
    await appendMessage(ctx.tx, ctx.storeId, target, {
      sender: 'system',
      kind: 'system',
      body: '',
      payload: { event: 'merged_guest', from: openGuest.id, count: moved.length },
    })
    // Client ids are per conversation; a moved one could clash, so they are dropped.
    await ctx.tx
      .update(inboxMessage)
      .set({ conversationId: target.id, clientId: null })
      .where(eq(inboxMessage.conversationId, openGuest.id))
    await ctx.tx
      .update(inboxConversation)
      .set({
        unreadStaff: sql`${inboxConversation.unreadStaff} + ${openGuest.unreadStaff}`,
        lastMessageAt: sql`greatest(${inboxConversation.lastMessageAt}, ${openGuest.lastMessageAt.toISOString()}::timestamptz)`,
        updatedAt: new Date(),
      })
      .where(eq(inboxConversation.id, target.id))
    await ctx.tx.delete(inboxConversation).where(eq(inboxConversation.id, openGuest.id))
    movedInto = target.id
  }
  const gone = movedInto ? openGuest?.id : undefined
  const rest = guest.filter((g) => g.id !== gone).map((g) => g.id)
  if (rest.length > 0) {
    await ctx.tx
      .update(inboxConversation)
      .set({
        customerId: input.customerId,
        contactVerified: true,
        contactEmail: c.email,
        contactName: sql`coalesce(${inboxConversation.contactName}, ${c.name})`,
        updatedAt: new Date(),
      })
      .where(inArray(inboxConversation.id, rest))
  }
  return { merged: guest.length, movedInto }
}

export type CartEvent = {
  action: 'add' | 'remove' | 'quantity'
  variantId: string
  title: string
  quantity: number
  /** The cart it happened in, so the staff panel can show a guest's live cart. */
  cartId?: string
}

/**
 * A cart change, as a line in the shopper's open conversation. Does nothing when they have
 * none (the caller checks the cookie first, so most shoppers cost no query at all).
 */
export async function postCartEvent(
  ctx: StoreContext,
  who: ShopperIdentity,
  event: CartEvent,
): Promise<InboxMessageRow | null> {
  const owner = ownerFilter(who)
  if (!owner) return null
  const [open] = await ctx.tx
    .select()
    .from(inboxConversation)
    .where(and(owner, eq(inboxConversation.status, 'open')))
    .orderBy(desc(inboxConversation.lastMessageAt))
    .limit(1)
  if (!open || !canShopperAccess(open, who)) return null
  const { message } = await appendMessage(ctx.tx, ctx.storeId, open, {
    sender: 'system',
    kind: 'cart_event',
    body: '',
    payload: { ...event },
  })
  return message
}

/** Conversations of one customer, newest first (the Conversations card, privacy export). */
export function customerConversations(tx: StoreTx, customerId: string) {
  return tx
    .select()
    .from(inboxConversation)
    .where(eq(inboxConversation.customerId, customerId))
    .orderBy(desc(inboxConversation.lastMessageAt))
}
