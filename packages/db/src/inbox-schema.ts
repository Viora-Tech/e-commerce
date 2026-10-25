import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { customer, newId, store } from './schema'

/*
 * Inbox, our Shopify Inbox: shoppers chat from the storefront widget, staff answer from the
 * admin `/inbox` page. Every table is a tenant table (forced RLS on `store_id`). Ids are UUIDv7,
 * so they sort by time: the realtime replay ("everything after Last-Event-ID") is `id > $last`.
 * Design: docs/superpowers/specs/2026-10-24-inbox-design.md §3. The word lists are the ones in
 * @commerce/core/inbox `constants.ts` (a test checks they match).
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const at = (name: string) => timestamp(name, { withTimezone: true })
const oneOf = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '))

export const INBOX_CHANNELS = ['web', 'whatsapp', 'instagram', 'messenger'] as const
export const INBOX_STATUSES = ['open', 'closed', 'blocked'] as const
export const INBOX_BLOCKED_REASONS = ['spam', 'staff'] as const
export const INBOX_SENDERS = ['shopper', 'staff', 'system', 'ai'] as const
export const INBOX_MESSAGE_KINDS = [
  'text',
  'product',
  'discount',
  'image',
  'cart_event',
  'note',
  'system',
  'template',
] as const
export const INBOX_BLOCK_KINDS = ['visitor', 'email', 'ip'] as const
/** What the Inbox AI agent did with one shopper message. */
const INBOX_AI_EVENT_KINDS = ['answer', 'handoff'] as const
/** Why the AI agent handed a conversation to a person (design §13). */
const INBOX_HANDOFF_REASONS = [
  'asked_for_human',
  'not_confident',
  'order_problem',
  'upset',
  'outside_store',
] as const

export type InboxChannel = (typeof INBOX_CHANNELS)[number]
export type InboxStatus = (typeof INBOX_STATUSES)[number]
export type InboxBlockedReason = (typeof INBOX_BLOCKED_REASONS)[number]
export type InboxSender = (typeof INBOX_SENDERS)[number]
export type InboxMessageKind = (typeof INBOX_MESSAGE_KINDS)[number]
export type InboxBlockKind = (typeof INBOX_BLOCK_KINDS)[number]

/**
 * One chat thread. A guest is known by `visitor_key_hash` (sha256 of the `wc_chat` cookie, never
 * the cookie itself); a signed-in shopper by `customer_id`. Once a thread is tied to a customer
 * only that customer can read it. Contact fields are what the shopper typed: unverified unless
 * `contact_verified` (the thread belongs to a signed-in customer).
 */
export const inboxConversation = pgTable(
  'inbox_conversation',
  {
    id: id(),
    storeId: storeId(),
    channel: text('channel', { enum: INBOX_CHANNELS }).notNull().default('web'),
    status: text('status', { enum: INBOX_STATUSES }).notNull().default('open'),
    blockedReason: text('blocked_reason', { enum: INBOX_BLOCKED_REASONS }),
    customerId: uuid('customer_id').references(() => customer.id, { onDelete: 'set null' }),
    /** sha256 hex of the guest's `wc_chat` cookie. */
    visitorKeyHash: text('visitor_key_hash'),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    /** Encrypted like `customer.phone` (`encryptCustomerPhone`), with its blind index beside it. */
    contactPhone: text('contact_phone'),
    contactPhoneIndex: text('contact_phone_index'),
    contactVerified: boolean('contact_verified').notNull().default(false),
    /** Better Auth user id of the staff member it is assigned to (like `created_by` elsewhere). */
    assigneeUserId: text('assignee_user_id'),
    lastMessageAt: at('last_message_at').notNull().defaultNow(),
    /** At most 140 characters of the latest message the shopper can see. */
    lastMessagePreview: text('last_message_preview'),
    lastSender: text('last_sender', { enum: INBOX_SENDERS }),
    unreadStaff: integer('unread_staff').notNull().default(0),
    unreadShopper: integer('unread_shopper').notNull().default(0),
    shopperSeenMessageId: uuid('shopper_seen_message_id'),
    staffSeenMessageId: uuid('staff_seen_message_id'),
    firstResponseAt: at('first_response_at'),
    closedAt: at('closed_at'),
    closedBy: text('closed_by'),
    startedUrl: text('started_url'),
    /** HMAC of the IP the thread was started from: the "same text from one IP" spam rule. */
    ipHash: text('ip_hash'),
    /** When the unanswered-message email digest last mentioned this thread. */
    unansweredAlertedAt: at('unanswered_alerted_at'),
    /** Reserved for v2 channels (WhatsApp wa_id, Instagram IGSID) and their 24 h window. */
    externalThreadId: text('external_thread_id'),
    sessionExpiresAt: at('session_expires_at'),
    /** Reserved for v1.5 "orders assisted". */
    attributedOrderId: uuid('attributed_order_id'),
    /** The AI agent handed this conversation to a person; it stays quiet until staff close it. */
    needsHuman: boolean('needs_human').notNull().default(false),
    /** The AI agent's short summary for staff, written when it handed off. */
    handoffSummary: text('handoff_summary'),
    handoffAt: at('handoff_at'),
    anonymisedAt: at('anonymised_at'),
    createdAt: createdAt(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('inbox_conversation_store_status_last').on(t.storeId, t.status, t.lastMessageAt.desc()),
    index('inbox_conversation_store_assignee').on(t.storeId, t.assigneeUserId, t.status),
    index('inbox_conversation_store_customer').on(t.storeId, t.customerId),
    uniqueIndex('inbox_conversation_open_visitor')
      .on(t.storeId, t.visitorKeyHash)
      .where(sql`${t.status} = 'open'`),
    check('inbox_conversation_channel_check', sql`${t.channel} in (${oneOf(INBOX_CHANNELS)})`),
    check('inbox_conversation_status_check', sql`${t.status} in (${oneOf(INBOX_STATUSES)})`),
    check(
      'inbox_conversation_blocked_reason_check',
      sql`${t.blockedReason} is null or ${t.blockedReason} in (${oneOf(INBOX_BLOCKED_REASONS)})`,
    ),
    check(
      'inbox_conversation_last_sender_check',
      sql`${t.lastSender} is null or ${t.lastSender} in (${oneOf(INBOX_SENDERS)})`,
    ),
  ],
)

/**
 * One message. `note` is staff-only and never reaches the shopper. `client_id` is the sender's
 * own id for the message, so a resend after a dropped connection never stores it twice.
 */
export const inboxMessage = pgTable(
  'inbox_message',
  {
    id: id(),
    storeId: storeId(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => inboxConversation.id, { onDelete: 'cascade' }),
    sender: text('sender', { enum: INBOX_SENDERS }).notNull(),
    /** The staff member's Better Auth user id, for staff messages and notes. */
    memberUserId: text('member_user_id'),
    kind: text('kind', { enum: INBOX_MESSAGE_KINDS }).notNull().default('text'),
    body: text('body').notNull().default(''),
    /** Product: variant/product ids. Discount: discount id and code. Image: media id. Cart: the change. */
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    clientId: text('client_id'),
    /** Reserved for v2 channels. */
    externalId: text('external_id'),
    deliveryStatus: text('delivery_status'),
    createdAt: createdAt(),
  },
  (t) => [
    index('inbox_message_conversation').on(t.conversationId, t.id),
    /** The AI agent's look-up of the store's past questions and the team's replies. */
    index('inbox_message_store_sender').on(t.storeId, t.sender, t.id),
    uniqueIndex('inbox_message_client').on(t.conversationId, t.clientId),
    check('inbox_message_sender_check', sql`${t.sender} in (${oneOf(INBOX_SENDERS)})`),
    check('inbox_message_kind_check', sql`${t.kind} in (${oneOf(INBOX_MESSAGE_KINDS)})`),
    check('inbox_message_body_length', sql`char_length(${t.body}) <= 2000`),
  ],
)

/** Saved replies staff insert by typing `/shortcut` in the composer. */
export const inboxQuickReply = pgTable(
  'inbox_quick_reply',
  {
    id: id(),
    storeId: storeId(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    shortcut: text('shortcut').notNull(),
    position: integer('position').notNull().default(0),
    createdBy: text('created_by'),
    createdAt: createdAt(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('inbox_quick_reply_shortcut').on(t.storeId, t.shortcut)],
)

/**
 * A blocked sender: a browser (visitor key hash), an email or an IP, each stored as a hash.
 * IP blocks expire after 30 days; the others never do (`expires_at` null).
 */
export const inboxBlock = pgTable(
  'inbox_block',
  {
    id: id(),
    storeId: storeId(),
    kind: text('kind', { enum: INBOX_BLOCK_KINDS }).notNull(),
    valueHash: text('value_hash').notNull(),
    reason: text('reason', { enum: INBOX_BLOCKED_REASONS }).notNull().default('staff'),
    /** The conversation the block was made from, when there was one (shown in the list). */
    conversationId: uuid('conversation_id').references(() => inboxConversation.id, {
      onDelete: 'set null',
    }),
    createdBy: text('created_by'),
    expiresAt: at('expires_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('inbox_block_value').on(t.storeId, t.kind, t.valueHash),
    check('inbox_block_kind_check', sql`${t.kind} in (${oneOf(INBOX_BLOCK_KINDS)})`),
    check('inbox_block_reason_check', sql`${t.reason} in (${oneOf(INBOX_BLOCKED_REASONS)})`),
  ],
)

/**
 * A staff member's browser push subscription (Web Push, VAPID). Generic on purpose; only Inbox
 * sends to it for now. `p256dh` and `auth` are encrypted with `encryptSecret`.
 */
export const memberPushSubscription = pgTable(
  'member_push_subscription',
  {
    id: id(),
    storeId: storeId(),
    userId: text('user_id').notNull(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    lastOkAt: at('last_ok_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('member_push_subscription_endpoint').on(t.storeId, t.endpoint),
    index('member_push_subscription_user').on(t.storeId, t.userId),
  ],
)

/**
 * One thing the Inbox AI agent did: an answer or a hand-off, with why, how sure it was and the
 * tokens it used. Feeds "resolved by AI vs handed off"; never holds message text.
 */
export const inboxAiEvent = pgTable(
  'inbox_ai_event',
  {
    id: id(),
    storeId: storeId(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => inboxConversation.id, { onDelete: 'cascade' }),
    /** The shopper message it answered. */
    messageId: uuid('message_id'),
    kind: text('kind', { enum: INBOX_AI_EVENT_KINDS }).notNull(),
    reason: text('reason', { enum: INBOX_HANDOFF_REASONS }),
    /** 0 to 100. */
    confidence: integer('confidence'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('inbox_ai_event_store_created').on(t.storeId, t.createdAt),
    uniqueIndex('inbox_ai_event_message').on(t.conversationId, t.messageId),
    check('inbox_ai_event_kind_check', sql`${t.kind} in (${oneOf(INBOX_AI_EVENT_KINDS)})`),
  ],
)
