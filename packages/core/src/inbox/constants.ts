/** SOURCE OF TRUTH: INBOX_APP_ID, inbox word lists and limits — WHAT: the Inbox app's id, conversation statuses, views, message kinds and size limits / WHY: the admin, the storefront widget, the API and the schema checks must agree (inbox-schema.ts keeps its own copy; constants.test.ts checks they match). Pure: client components import it through `@commerce/core/inbox`. */

export const INBOX_APP_ID = 'inbox'

export const CONVERSATION_STATUSES = ['open', 'closed', 'blocked'] as const
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

export const BLOCKED_REASONS = ['spam', 'staff'] as const
export type BlockedReason = (typeof BLOCKED_REASONS)[number]

export const MESSAGE_SENDERS = ['shopper', 'staff', 'system', 'ai'] as const
export type MessageSender = (typeof MESSAGE_SENDERS)[number]

export const MESSAGE_KINDS = [
  'text',
  'product',
  'discount',
  'image',
  'cart_event',
  'note',
  'system',
  'template',
] as const
export type MessageKind = (typeof MESSAGE_KINDS)[number]

/** What staff can send from the composer. */
export const STAFF_MESSAGE_KINDS = ['text', 'note', 'product', 'discount', 'image'] as const
export type StaffMessageKind = (typeof STAFF_MESSAGE_KINDS)[number]

/** What a shopper can send from the widget. */
export const SHOPPER_MESSAGE_KINDS = ['text', 'image'] as const
export type ShopperMessageKind = (typeof SHOPPER_MESSAGE_KINDS)[number]

export const BLOCK_KINDS = ['visitor', 'email', 'ip'] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]

/** The inbox list's tabs. */
export const INBOX_VIEWS = ['open', 'mine', 'unassigned', 'closed', 'blocked'] as const
export type InboxView = (typeof INBOX_VIEWS)[number]

/** Longest message body. */
export const MESSAGE_MAX = 2000
/** Longest preview kept on the conversation for the list. */
export const PREVIEW_MAX = 140
/** Most products one product card may carry. */
export const PRODUCTS_PER_CARD_MAX = 3
/** Messages one page of a thread returns. */
export const THREAD_PAGE = 50
/** Conversations one page of the list returns. */
export const LIST_PAGE = 30
/** How long an IP block lasts. Visitor and email blocks never expire. */
export const IP_BLOCK_DAYS = 30
/** Quick reply shortcut: typed after `/` in the composer. */
export const SHORTCUT_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/
