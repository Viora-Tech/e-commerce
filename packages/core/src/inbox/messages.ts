/** SOURCE OF TRUTH: appendMessage, messagesAfter, threadPage, InboxError — WHAT: storing one message (idempotent on the sender's client id) with the conversation's preview, unread counters and first-response time kept in step, and reading a thread (one page back, or everything after a message id for the realtime replay) / WHY: staff, shopper and system messages all go through one writer so the list never disagrees with the thread (design §3, §4). */
import { inboxConversation, inboxMessage, type StoreTx } from '@commerce/db'
import { and, asc, desc, eq, gt, lt, ne, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { MESSAGE_MAX, type MessageKind, type MessageSender, THREAD_PAGE } from './constants'
import { previewOf } from './rules'

export class InboxError extends CommerceError {
  constructor(
    code:
      | 'INBOX_NOT_FOUND'
      | 'INBOX_INVALID'
      | 'INBOX_BLOCKED'
      | 'INBOX_SIGN_IN_REQUIRED'
      | 'INBOX_NOT_INSTALLED'
      | 'INBOX_RATE_LIMITED',
    message: string,
    storeId?: string,
  ) {
    super(code, message, { storeId })
  }
}

export type InboxConversationRow = typeof inboxConversation.$inferSelect
export type InboxMessageRow = typeof inboxMessage.$inferSelect

/** What a message looks like to the admin and the widget. */
export type InboxMessageView = {
  id: string
  conversationId: string
  sender: MessageSender
  memberUserId: string | null
  kind: MessageKind
  body: string
  payload: Record<string, unknown> | null
  clientId: string | null
  createdAt: Date
}

export function messageView(m: InboxMessageRow): InboxMessageView {
  return {
    id: m.id,
    conversationId: m.conversationId,
    sender: m.sender,
    memberUserId: m.memberUserId,
    kind: m.kind,
    body: m.body,
    payload: m.payload ?? null,
    clientId: m.clientId,
    createdAt: m.createdAt,
  }
}

export type AppendMessage = {
  sender: MessageSender
  kind: MessageKind
  body: string
  payload?: Record<string, unknown> | null
  memberUserId?: string | null
  clientId?: string | null
}

/** The list preview for a message: its text, or a short label for a card. */
function previewFor(m: AppendMessage): string {
  if (m.body.trim()) return previewOf(m.body)
  const labels: Partial<Record<MessageKind, string>> = {
    product: '[Product]',
    discount: '[Discount]',
    image: '[Image]',
    cart_event: '[Cart]',
  }
  return labels[m.kind] ?? ''
}

/**
 * Stores one message in `conversation` and updates the conversation in the same transaction.
 * A resend with the same `clientId` returns the first copy (`created: false`) and changes
 * nothing. Notes and system lines never touch the shopper's unread count or the preview.
 */
export async function appendMessage(
  tx: StoreTx,
  storeId: string,
  conversation: Pick<InboxConversationRow, 'id' | 'firstResponseAt'>,
  m: AppendMessage,
  now: Date = new Date(),
): Promise<{ message: InboxMessageRow; created: boolean }> {
  if (m.body.length > MESSAGE_MAX) {
    throw new InboxError('INBOX_INVALID', `A message is at most ${MESSAGE_MAX} characters`, storeId)
  }
  const [inserted] = await tx
    .insert(inboxMessage)
    .values({
      storeId,
      conversationId: conversation.id,
      sender: m.sender,
      kind: m.kind,
      body: m.body,
      payload: m.payload ?? null,
      memberUserId: m.memberUserId ?? null,
      clientId: m.clientId ?? null,
      createdAt: now,
    })
    .onConflictDoNothing({ target: [inboxMessage.conversationId, inboxMessage.clientId] })
    .returning()
  if (!inserted) {
    const [existing] = await tx
      .select()
      .from(inboxMessage)
      .where(
        and(
          eq(inboxMessage.conversationId, conversation.id),
          eq(inboxMessage.clientId, m.clientId ?? ''),
        ),
      )
    if (!existing) throw new InboxError('INBOX_INVALID', 'Message could not be stored', storeId)
    return { message: existing, created: false }
  }

  const visibleToShopper = m.kind !== 'note'
  const counts = m.sender === 'shopper' || (m.sender === 'staff' && visibleToShopper)
  const patch: Partial<typeof inboxConversation.$inferInsert> = { updatedAt: now }
  if (visibleToShopper && m.sender !== 'system') {
    patch.lastMessageAt = now
    patch.lastMessagePreview = previewFor(m)
    patch.lastSender = m.sender
  }
  if (m.sender === 'shopper') {
    await tx
      .update(inboxConversation)
      .set({ ...patch, unreadStaff: sql`${inboxConversation.unreadStaff} + 1` })
      .where(eq(inboxConversation.id, conversation.id))
  } else if (counts) {
    await tx
      .update(inboxConversation)
      .set({
        ...patch,
        unreadShopper: sql`${inboxConversation.unreadShopper} + 1`,
        // A staff reply means the shopper's messages so far were read.
        unreadStaff: 0,
        // A person answered: the AI's hand-off is done.
        needsHuman: false,
        staffSeenMessageId: inserted.id,
        ...(conversation.firstResponseAt ? {} : { firstResponseAt: now }),
      })
      .where(eq(inboxConversation.id, conversation.id))
  } else if (m.sender === 'ai') {
    // The AI agent's answer is unread for the shopper; staff still see the thread as unread.
    await tx
      .update(inboxConversation)
      .set({ ...patch, unreadShopper: sql`${inboxConversation.unreadShopper} + 1` })
      .where(eq(inboxConversation.id, conversation.id))
  } else {
    await tx.update(inboxConversation).set(patch).where(eq(inboxConversation.id, conversation.id))
  }
  return { message: inserted, created: true }
}

type ThreadOpts = {
  /** Staff see notes; the shopper never does. */
  includeNotes: boolean
}

/**
 * Everything after `afterId` in time order (UUIDv7 ids sort by time): the realtime replay on
 * reconnect with `Last-Event-ID`, and the polling fallback. At most `limit` rows.
 */
export async function messagesAfter(
  tx: StoreTx,
  conversationId: string,
  afterId: string | null,
  opts: ThreadOpts & { limit?: number },
): Promise<InboxMessageRow[]> {
  return tx
    .select()
    .from(inboxMessage)
    .where(
      and(
        eq(inboxMessage.conversationId, conversationId),
        afterId ? gt(inboxMessage.id, afterId) : undefined,
        opts.includeNotes ? undefined : ne(inboxMessage.kind, 'note'),
      ),
    )
    .orderBy(asc(inboxMessage.id))
    .limit(opts.limit ?? 200)
}

/** One page of a thread going back in time from `beforeId` (the newest page when absent), oldest first. */
export async function threadPage(
  tx: StoreTx,
  conversationId: string,
  beforeId: string | null,
  opts: ThreadOpts,
): Promise<{ messages: InboxMessageRow[]; hasMore: boolean }> {
  const rows = await tx
    .select()
    .from(inboxMessage)
    .where(
      and(
        eq(inboxMessage.conversationId, conversationId),
        beforeId ? lt(inboxMessage.id, beforeId) : undefined,
        opts.includeNotes ? undefined : ne(inboxMessage.kind, 'note'),
      ),
    )
    .orderBy(desc(inboxMessage.id))
    .limit(THREAD_PAGE + 1)
  return { messages: rows.slice(0, THREAD_PAGE).reverse(), hasMore: rows.length > THREAD_PAGE }
}
