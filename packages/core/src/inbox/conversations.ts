/** SOURCE OF TRUTH: listConversations, inboxCounts, getConversation, staffSend, markStaffSeen, assignConversation, setConversationStatus — WHAT: the staff side of Inbox: the list with its views and search, one thread, replies and notes (text, product, discount and image cards), assignment, and Open/Closed/Blocked / WHY: the admin `/inbox` page and its API (design §6, §7). */
import {
  customer,
  discount,
  inboxConversation,
  inboxMessage,
  media,
  order,
  product,
  type StoreTx,
  storeMember,
} from '@commerce/db'
import {
  and,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import {
  decryptCustomerPhone,
  normalisePhoneDigits,
  phoneBlindIndex,
} from '../customers/phone-crypto'
import { blockSender, removeConversationBlocks } from './blocks'
import {
  type ConversationStatus,
  INBOX_VIEWS,
  type InboxView,
  LIST_PAGE,
  MESSAGE_MAX,
  PRODUCTS_PER_CARD_MAX,
  STAFF_MESSAGE_KINDS,
} from './constants'
import { contactPhoneIndex, inboxHash } from './identity'
import {
  appendMessage,
  type InboxConversationRow,
  InboxError,
  type InboxMessageRow,
  threadPage,
} from './messages'

/** One row of the inbox list. */
export type ConversationSummary = {
  id: string
  status: ConversationStatus
  blockedReason: 'spam' | 'staff' | null
  customerId: string | null
  name: string | null
  email: string | null
  contactVerified: boolean
  assigneeUserId: string | null
  lastMessageAt: Date
  lastMessagePreview: string | null
  lastSender: InboxConversationRow['lastSender']
  unreadStaff: number
  /** The AI agent handed this chat to a person and nobody has replied yet. */
  needsHuman: boolean
  /** The AI agent's note for the team when it handed off. */
  handoffSummary: string | null
  createdAt: Date
}

const summaryColumns = {
  id: inboxConversation.id,
  status: inboxConversation.status,
  blockedReason: inboxConversation.blockedReason,
  customerId: inboxConversation.customerId,
  contactName: inboxConversation.contactName,
  contactEmail: inboxConversation.contactEmail,
  customerName: customer.name,
  customerEmail: customer.email,
  contactVerified: inboxConversation.contactVerified,
  assigneeUserId: inboxConversation.assigneeUserId,
  lastMessageAt: inboxConversation.lastMessageAt,
  lastMessagePreview: inboxConversation.lastMessagePreview,
  lastSender: inboxConversation.lastSender,
  unreadStaff: inboxConversation.unreadStaff,
  needsHuman: inboxConversation.needsHuman,
  handoffSummary: inboxConversation.handoffSummary,
  createdAt: inboxConversation.createdAt,
}

type SummaryRow = {
  [K in keyof typeof summaryColumns]: (typeof summaryColumns)[K]['_']['data'] | null
}

function summaryOf(r: SummaryRow): ConversationSummary {
  return {
    id: r.id as string,
    status: r.status as ConversationStatus,
    blockedReason: r.blockedReason,
    customerId: r.customerId,
    name: r.customerName ?? r.contactName,
    email: r.customerEmail ?? r.contactEmail,
    contactVerified: Boolean(r.contactVerified),
    assigneeUserId: r.assigneeUserId,
    lastMessageAt: r.lastMessageAt as Date,
    lastMessagePreview: r.lastMessagePreview,
    lastSender: r.lastSender,
    unreadStaff: r.unreadStaff ?? 0,
    needsHuman: Boolean(r.needsHuman),
    handoffSummary: r.handoffSummary,
    createdAt: r.createdAt as Date,
  }
}

function viewFilter(view: InboxView, userId: string): SQL | undefined {
  const c = inboxConversation
  if (view === 'open') return eq(c.status, 'open')
  if (view === 'needs_person') return and(eq(c.status, 'open'), eq(c.needsHuman, true))
  if (view === 'mine') return and(eq(c.status, 'open'), eq(c.assigneeUserId, userId))
  if (view === 'unassigned') return and(eq(c.status, 'open'), isNull(c.assigneeUserId))
  if (view === 'unread') return and(eq(c.status, 'open'), gt(c.unreadStaff, 0))
  if (view === 'closed') return eq(c.status, 'closed')
  if (view === 'all') return inArray(c.status, ['open', 'closed'])
  return eq(c.status, 'blocked')
}

/** Name, email, phone, a word from the thread, or an order number (`#1042` or `1042`). */
function searchFilter(raw: string, secret: string): SQL | undefined {
  const q = raw.trim()
  if (!q) return undefined
  const c = inboxConversation
  const orderNo = /^#?(\d{1,9})$/.exec(q)
  const digits = normalisePhoneDigits(q)
  const like = `%${q.replace(/[%_\\]/g, '')}%`
  const parts: (SQL | undefined)[] = [
    ilike(c.contactName, like),
    ilike(c.contactEmail, like),
    ilike(customer.name, like),
    ilike(customer.email, like),
    exists(
      sql`(select 1 from ${inboxMessage} where ${inboxMessage.conversationId} = ${c.id} and ${inboxMessage.body} ilike ${like})`,
    ),
  ]
  if (orderNo) {
    parts.push(
      exists(
        sql`(select 1 from ${order} where ${order.customerId} = ${c.customerId} and ${order.number} = ${Number(orderNo[1])})`,
      ),
    )
  }
  if (digits.length >= 6) {
    parts.push(
      eq(c.contactPhoneIndex, contactPhoneIndex(digits, secret)),
      eq(customer.phoneIndex, phoneBlindIndex(digits, secret)),
    )
  }
  return or(...parts)
}

export const ListConversationsSchema = z.object({
  view: z.enum(INBOX_VIEWS).default('open'),
  search: z.string().max(200).optional(),
  /** The last row of the previous page. */
  cursor: z.object({ lastMessageAt: z.coerce.date(), id: z.uuid() }).optional(),
})
export type ListConversationsInput = z.input<typeof ListConversationsSchema>

/** One page of the list, newest activity first. */
export async function listConversations(
  ctx: StoreContext,
  input: ListConversationsInput,
  opts: { userId: string; secret: string },
): Promise<{
  rows: ConversationSummary[]
  nextCursor: { lastMessageAt: Date; id: string } | null
}> {
  const { view, search, cursor } = ListConversationsSchema.parse(input)
  const c = inboxConversation
  const after = cursor
    ? or(
        lt(c.lastMessageAt, cursor.lastMessageAt),
        and(eq(c.lastMessageAt, cursor.lastMessageAt), lt(c.id, cursor.id)),
      )
    : undefined
  const rows = await ctx.tx
    .select(summaryColumns)
    .from(c)
    .leftJoin(customer, eq(customer.id, c.customerId))
    .where(
      and(
        viewFilter(view, opts.userId),
        search ? searchFilter(search, opts.secret) : undefined,
        after,
      ),
    )
    .orderBy(desc(c.lastMessageAt), desc(c.id))
    .limit(LIST_PAGE + 1)
  const page = rows.slice(0, LIST_PAGE).map(summaryOf)
  const last = page.at(-1)
  return {
    rows: page,
    nextCursor:
      rows.length > LIST_PAGE && last ? { lastMessageAt: last.lastMessageAt, id: last.id } : null,
  }
}

export type InboxCounts = Record<InboxView, number>

/** How many conversations each tab holds, and how many open ones have unread shopper messages. */
export async function inboxCounts(ctx: StoreContext, userId: string): Promise<InboxCounts> {
  const c = inboxConversation
  const [row] = await ctx.tx
    .select({
      open: sql<number>`count(*) filter (where ${c.status} = 'open')::int`,
      needs_person: sql<number>`count(*) filter (where ${c.status} = 'open' and ${c.needsHuman})::int`,
      mine: sql<number>`count(*) filter (where ${c.status} = 'open' and ${c.assigneeUserId} = ${userId})::int`,
      unassigned: sql<number>`count(*) filter (where ${c.status} = 'open' and ${c.assigneeUserId} is null)::int`,
      closed: sql<number>`count(*) filter (where ${c.status} = 'closed')::int`,
      all: sql<number>`count(*) filter (where ${c.status} in ('open', 'closed'))::int`,
      blocked: sql<number>`count(*) filter (where ${c.status} = 'blocked')::int`,
      unread: sql<number>`count(*) filter (where ${c.status} = 'open' and ${c.unreadStaff} > 0)::int`,
    })
    .from(c)
  return row ?? (Object.fromEntries(INBOX_VIEWS.map((v) => [v, 0])) as InboxCounts)
}

async function loadConversation(tx: StoreTx, storeId: string, id: string) {
  const [row] = await tx.select().from(inboxConversation).where(eq(inboxConversation.id, id))
  if (!row) throw new InboxError('INBOX_NOT_FOUND', 'Conversation not found', storeId)
  return row
}

/** What the thread header and the customer panel show about a conversation. */
export type ConversationDetail = ConversationSummary & {
  contactPhone: string | null
  startedUrl: string | null
  firstResponseAt: Date | null
  closedAt: Date | null
  shopperSeenMessageId: string | null
}

/** One conversation with the newest page of its thread (notes included), or older pages by `beforeId`. */
export async function getConversation(
  ctx: StoreContext,
  input: { id: string; beforeId?: string | null | undefined },
  secret: string,
): Promise<{ conversation: ConversationDetail; messages: InboxMessageRow[]; hasMore: boolean }> {
  const [row] = await ctx.tx
    .select({
      ...summaryColumns,
      contactPhone: inboxConversation.contactPhone,
      startedUrl: inboxConversation.startedUrl,
      firstResponseAt: inboxConversation.firstResponseAt,
      closedAt: inboxConversation.closedAt,
      shopperSeenMessageId: inboxConversation.shopperSeenMessageId,
    })
    .from(inboxConversation)
    .leftJoin(customer, eq(customer.id, inboxConversation.customerId))
    .where(eq(inboxConversation.id, input.id))
  if (!row) throw new InboxError('INBOX_NOT_FOUND', 'Conversation not found', ctx.storeId)
  const page = await threadPage(ctx.tx, input.id, input.beforeId ?? null, { includeNotes: true })
  return {
    conversation: {
      ...summaryOf(row),
      contactPhone: decryptCustomerPhone(row.contactPhone, secret),
      startedUrl: row.startedUrl,
      firstResponseAt: row.firstResponseAt,
      closedAt: row.closedAt,
      shopperSeenMessageId: row.shopperSeenMessageId,
    },
    ...page,
  }
}

export const StaffSendSchema = z.object({
  conversationId: z.uuid(),
  kind: z.enum(STAFF_MESSAGE_KINDS).default('text'),
  body: z.string().max(MESSAGE_MAX).default(''),
  /** Product card: up to 3 products. */
  productIds: z.array(z.uuid()).min(1).max(PRODUCTS_PER_CARD_MAX).optional(),
  /** Discount card: an active code. */
  discountId: z.uuid().optional(),
  /** Image: an uploaded media row. */
  mediaId: z.uuid().optional(),
  clientId: z.string().min(8).max(64).optional(),
})
export type StaffSendInput = z.input<typeof StaffSendSchema>

/** A code is shareable while it is on, has a code, and is inside its dates. */
export function isShareableDiscount(
  d: {
    kind: string
    code: string | null
    status: string
    startsAt: Date | null
    endsAt: Date | null
  },
  now: Date = new Date(),
): boolean {
  return (
    d.kind === 'code' &&
    Boolean(d.code) &&
    d.status === 'active' &&
    (!d.startsAt || d.startsAt <= now) &&
    (!d.endsAt || d.endsAt > now)
  )
}

async function cardPayload(
  ctx: StoreContext,
  input: z.output<typeof StaffSendSchema>,
): Promise<Record<string, unknown> | null> {
  const invalid = (message: string) => new InboxError('INBOX_INVALID', message, ctx.storeId)
  if (input.kind === 'product') {
    const ids = [...new Set(input.productIds ?? [])]
    if (ids.length === 0) throw invalid('Pick at least one product')
    const found = await ctx.tx
      .select({ id: product.id })
      .from(product)
      .where(and(inArray(product.id, ids), eq(product.status, 'active')))
    if (found.length !== ids.length) throw invalid('Only active products can be shared')
    return { productIds: ids }
  }
  if (input.kind === 'discount') {
    if (!input.discountId) throw invalid('Pick a discount code')
    const [d] = await ctx.tx.select().from(discount).where(eq(discount.id, input.discountId))
    if (!d || !isShareableDiscount(d)) throw invalid('Only active discount codes can be shared')
    return { discountId: d.id, code: d.code }
  }
  if (input.kind === 'image') {
    if (!input.mediaId) throw invalid('Pick an image')
    const [m] = await ctx.tx
      .select({ id: media.id, url: media.url })
      .from(media)
      .where(eq(media.id, input.mediaId))
    if (!m) throw invalid('Image not found')
    return { mediaId: m.id, url: m.url }
  }
  if (!input.body.trim()) throw invalid('Write a message')
  return null
}

/**
 * A staff reply or note. Replying to a closed conversation opens it again; a blocked one
 * refuses (unblock first). Notes stay staff-only and change no counter the shopper sees.
 */
export async function staffSend(
  ctx: StoreContext,
  raw: StaffSendInput,
  userId: string,
): Promise<{ conversation: InboxConversationRow; message: InboxMessageRow; created: boolean }> {
  const input = StaffSendSchema.parse(raw)
  const conversation = await loadConversation(ctx.tx, ctx.storeId, input.conversationId)
  if (conversation.status === 'blocked' && input.kind !== 'note') {
    throw new InboxError('INBOX_BLOCKED', 'Unblock this conversation to reply', ctx.storeId)
  }
  const payload = await cardPayload(ctx, input)
  const { message, created } = await appendMessage(ctx.tx, ctx.storeId, conversation, {
    sender: 'staff',
    kind: input.kind,
    body: input.body.trim(),
    payload,
    memberUserId: userId,
    clientId: input.clientId ?? null,
  })
  if (created && conversation.status === 'closed' && input.kind !== 'note') {
    await ctx.tx
      .update(inboxConversation)
      .set({ status: 'open', closedAt: null, closedBy: null })
      .where(eq(inboxConversation.id, conversation.id))
  }
  return {
    conversation: await loadConversation(ctx.tx, ctx.storeId, conversation.id),
    message,
    created,
  }
}

/** Staff opened the thread: nothing in it is unread for staff any more. Returns the last message id. */
export async function markStaffSeen(ctx: StoreContext, id: string): Promise<string | null> {
  const [last] = await ctx.tx
    .select({ id: inboxMessage.id })
    .from(inboxMessage)
    .where(eq(inboxMessage.conversationId, id))
    .orderBy(desc(inboxMessage.id))
    .limit(1)
  await ctx.tx
    .update(inboxConversation)
    .set({ unreadStaff: 0, staffSeenMessageId: last?.id ?? null })
    .where(eq(inboxConversation.id, id))
  return last?.id ?? null
}

/** Assigns to a store member (who then is the only one notified), or unassigns with null. */
export async function assignConversation(
  ctx: StoreContext,
  input: { id: string; assigneeUserId: string | null },
  userId: string,
): Promise<InboxConversationRow> {
  const conversation = await loadConversation(ctx.tx, ctx.storeId, input.id)
  if (input.assigneeUserId) {
    const [m] = await ctx.tx
      .select({ id: storeMember.id })
      .from(storeMember)
      .where(and(eq(storeMember.userId, input.assigneeUserId), eq(storeMember.status, 'active')))
    if (!m) throw new InboxError('INBOX_INVALID', 'That person is not on this store', ctx.storeId)
  }
  if (conversation.assigneeUserId === input.assigneeUserId) return conversation
  await ctx.tx
    .update(inboxConversation)
    .set({ assigneeUserId: input.assigneeUserId, updatedAt: new Date() })
    .where(eq(inboxConversation.id, input.id))
  await appendMessage(ctx.tx, ctx.storeId, conversation, {
    sender: 'system',
    kind: 'system',
    body: '',
    payload: {
      event: input.assigneeUserId ? 'assigned' : 'unassigned',
      to: input.assigneeUserId,
      by: userId,
    },
  })
  return loadConversation(ctx.tx, ctx.storeId, input.id)
}

export const SetStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(['open', 'closed', 'blocked']),
})

/**
 * Close, reopen or block. Blocking also blocks the sender's browser and email so a new thread
 * from them lands in Blocked too; unblocking (back to Open) lifts those blocks.
 */
export async function setConversationStatus(
  ctx: StoreContext,
  input: z.input<typeof SetStatusSchema>,
  opts: { userId: string; secret: string },
): Promise<InboxConversationRow> {
  const conversation = await loadConversation(ctx.tx, ctx.storeId, input.id)
  if (conversation.status === input.status) return conversation
  const now = new Date()
  const patch: Partial<typeof inboxConversation.$inferInsert> = {
    status: input.status,
    updatedAt: now,
  }
  if (input.status === 'closed')
    Object.assign(patch, { closedAt: now, closedBy: opts.userId, needsHuman: false })
  if (input.status === 'open')
    Object.assign(patch, { closedAt: null, closedBy: null, blockedReason: null })
  if (input.status === 'blocked') {
    patch.blockedReason = 'staff'
    if (conversation.visitorKeyHash) {
      await blockSender(ctx, {
        kind: 'visitor',
        valueHash: conversation.visitorKeyHash,
        reason: 'staff',
        conversationId: conversation.id,
        userId: opts.userId,
      })
    }
    if (conversation.contactEmail && !conversation.customerId) {
      await blockSender(ctx, {
        kind: 'email',
        valueHash: inboxHash('email', conversation.contactEmail, opts.secret),
        reason: 'staff',
        conversationId: conversation.id,
        userId: opts.userId,
      })
    }
  }
  if (conversation.status === 'blocked') await removeConversationBlocks(ctx.tx, conversation.id)
  if (input.status === 'open' && conversation.visitorKeyHash) {
    // Only one open thread per browser: reopening an older one closes any newer open one.
    await ctx.tx
      .update(inboxConversation)
      .set({ status: 'closed', closedAt: now, closedBy: opts.userId })
      .where(
        and(
          eq(inboxConversation.visitorKeyHash, conversation.visitorKeyHash),
          eq(inboxConversation.status, 'open'),
        ),
      )
  }
  await ctx.tx.update(inboxConversation).set(patch).where(eq(inboxConversation.id, input.id))
  await appendMessage(ctx.tx, ctx.storeId, conversation, {
    sender: 'system',
    kind: 'system',
    body: '',
    payload: { event: input.status, by: opts.userId },
  })
  return loadConversation(ctx.tx, ctx.storeId, input.id)
}
