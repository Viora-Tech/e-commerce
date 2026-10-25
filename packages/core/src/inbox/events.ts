/** SOURCE OF TRUTH: messageEvents, statusEvents, typingEvent, seenEvents, storeReplay, shopperReplay, inboxSync — WHAT: which realtime events a write sends on which channel (staff get everything on the store channel; a shopper's conversation channel never carries notes or who on the staff wrote), the Postgres replay each stream runs on connect, and the polling read `inbox.sync` / WHY: the stream, the replay and the poll must hand a client the same messages (design §4). */
import { type Db, inboxConversation, inboxMessage, type StoreTx, withStore } from '@commerce/db'
import { and, asc, desc, eq, gt, gte, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type InboxCounts, inboxCounts } from './conversations'
import { type InboxConversationRow, type InboxMessageRow, messageView } from './messages'
import { type InboxEvent, type InboxPublish, inboxChannels, replayFloorId } from './realtime'
import { shopperMessageOf } from './shopper'

const REPLAY_LIMIT = 200

/** UUIDv7 ids start with their millisecond timestamp. */
const idTime = (id: string) => new Date(Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16))

const conversationEvent = (c: InboxConversationRow): InboxEvent => ({
  type: 'conversation',
  conversationId: c.id,
  status: c.status,
  unreadStaff: c.unreadStaff,
})

/** A new message: the full message and the list row to staff; the shopper's view to the shopper. */
export function messageEvents(
  storeId: string,
  conversation: InboxConversationRow,
  message: InboxMessageRow,
): InboxPublish[] {
  const store = inboxChannels.store(storeId)
  const events: InboxPublish[] = [
    {
      channel: store,
      event: {
        type: 'message',
        conversationId: conversation.id,
        message: { ...messageView(message) },
      },
    },
    { channel: store, event: conversationEvent(conversation) },
  ]
  // A spam thread stays silent; notes never leave the staff side.
  if (message.kind !== 'note' && conversation.status !== 'blocked') {
    events.push({
      channel: inboxChannels.conversation(conversation.id),
      event: {
        type: 'message',
        conversationId: conversation.id,
        message: { ...shopperMessageOf(message) },
      },
    })
  }
  return events
}

/** Status or assignment changed: staff lists update. */
export const statusEvents = (
  storeId: string,
  conversation: InboxConversationRow,
): InboxPublish[] => [
  { channel: inboxChannels.store(storeId), event: conversationEvent(conversation) },
]

/** "Typing…": to the other side only, never stored. */
export function typingEvent(
  storeId: string,
  conversationId: string,
  sender: 'shopper' | 'staff',
): InboxPublish {
  return {
    channel:
      sender === 'staff'
        ? inboxChannels.conversation(conversationId)
        : inboxChannels.store(storeId),
    event: { type: 'typing', conversationId, sender },
  }
}

/** Seen marks: staff seeing reaches the shopper ("Seen"), the shopper seeing reaches staff. */
export function seenEvents(
  storeId: string,
  conversationId: string,
  by: 'shopper' | 'staff',
  messageId: string | null,
): InboxPublish[] {
  const event: InboxEvent = { type: 'seen', conversationId, by, messageId }
  return by === 'staff'
    ? [
        { channel: inboxChannels.conversation(conversationId), event },
        { channel: inboxChannels.store(storeId), event },
      ]
    : [{ channel: inboxChannels.store(storeId), event }]
}

/** The admin stream's replay: every message in the store after the floor, notes included. */
export async function storeReplay(tx: StoreTx, floorId: string | null): Promise<InboxEvent[]> {
  if (!floorId) return []
  const rows = await tx
    .select()
    .from(inboxMessage)
    .where(gt(inboxMessage.id, floorId))
    .orderBy(asc(inboxMessage.id))
    .limit(REPLAY_LIMIT)
  return rows.map((m) => ({
    type: 'message',
    conversationId: m.conversationId,
    message: { ...messageView(m) },
  }))
}

/** `storeReplay` in its own short store transaction (the admin stream route holds no connection). */
export const replayForStore = (db: Db, storeId: string, floorId: string | null) =>
  withStore(db, storeId, (tx) => storeReplay(tx, floorId))

/** A shopper stream's replay: their conversation's messages after the floor, without notes. */
export async function shopperReplay(
  tx: StoreTx,
  conversationId: string,
  floorId: string | null,
): Promise<InboxEvent[]> {
  if (!floorId) return []
  const rows = await tx
    .select()
    .from(inboxMessage)
    .where(
      and(
        eq(inboxMessage.conversationId, conversationId),
        gt(inboxMessage.id, floorId),
        ne(inboxMessage.kind, 'note'),
      ),
    )
    .orderBy(asc(inboxMessage.id))
    .limit(REPLAY_LIMIT)
  return rows.map((m) => ({ type: 'message', conversationId, message: { ...shopperMessageOf(m) } }))
}

export type InboxSync = {
  /** Pass back as `since` on the next poll. */
  cursor: string | null
  messages: ReturnType<typeof messageView>[]
  /** Conversations whose row changed since the cursor (status, unread, preview). */
  conversations: { id: string; status: string; unreadStaff: number; updatedAt: Date }[]
  counts: InboxCounts
}

/**
 * The admin's polling fallback (every 4 s while the tab is visible): what changed since
 * `since` (a message id), starting 5 s early so a write that committed late is not missed.
 * Without `since` it returns only the cursor and counts, to start from.
 */
export async function inboxSync(
  ctx: StoreContext,
  input: { since?: string | null | undefined },
  userId: string,
): Promise<InboxSync> {
  const floor = replayFloorId(input.since)
  const counts = await inboxCounts(ctx, userId)
  const messages = floor
    ? await ctx.tx
        .select()
        .from(inboxMessage)
        .where(gt(inboxMessage.id, floor))
        .orderBy(asc(inboxMessage.id))
        .limit(REPLAY_LIMIT)
    : []
  const conversations = floor
    ? await ctx.tx
        .select({
          id: inboxConversation.id,
          status: inboxConversation.status,
          unreadStaff: inboxConversation.unreadStaff,
          updatedAt: inboxConversation.updatedAt,
        })
        .from(inboxConversation)
        .where(gte(inboxConversation.updatedAt, idTime(floor)))
        .limit(REPLAY_LIMIT)
    : []
  const cursor = messages.at(-1)?.id ?? input.since ?? (await latestMessageId(ctx.tx))
  return { cursor, messages: messages.map(messageView), conversations, counts }
}

async function latestMessageId(tx: StoreTx): Promise<string | null> {
  const [last] = await tx
    .select({ id: inboxMessage.id })
    .from(inboxMessage)
    .orderBy(desc(inboxMessage.id))
    .limit(1)
  return last?.id ?? null
}
