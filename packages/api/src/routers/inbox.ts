import { settingsSecret } from '@commerce/config'
import {
  CommerceError,
  checkRateLimit,
  createMemoryRateLimitStore,
  permissions,
  retryAfterSeconds,
} from '@commerce/core'
import {
  assignConversation,
  bringOverImportedFacts,
  createKnowledge,
  createQuickReply,
  customerPanel,
  deleteKnowledge,
  deleteQuickReply,
  getConversation,
  INBOX_LIMITS,
  InboxSettingsPatchSchema,
  importedFactsSource,
  inboxAssignees,
  inboxCounts,
  inboxLimitKey,
  inboxMetrics,
  inboxState,
  inboxSync,
  KnowledgeInputSchema,
  KnowledgeUpdateSchema,
  knowledgeCounts,
  ListConversationsSchema,
  listBlocks,
  listConversations,
  listKnowledge,
  listQuickReplies,
  markStaffSeen,
  messageCards,
  messageEvents,
  messageView,
  publishInboxEvents,
  QuickReplyInputSchema,
  QuickReplyUpdateSchema,
  removeBlock,
  reorderKnowledge,
  reorderQuickReplies,
  SetStatusSchema,
  StaffSendSchema,
  saveInboxSettings,
  seenEvents,
  setConversationStatus,
  setKnowledgePublished,
  shareableDiscounts,
  staffSend,
  statusEvents,
  takeOverConversation,
  typingEvent,
  updateKnowledge,
  updateQuickReply,
} from '@commerce/core/inbox/server'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { ApiContext } from '../context'
import { type AfterCommit, BULK_MAX, can, canDetached, type StoreScope } from '../procedures'
import {
  inboxAiAvailable,
  suggestInboxReplies,
  summariseInboxChat,
} from '../services/ai/inbox-assist'

type Ctx = ApiContext & { tx: StoreTx; scope: StoreScope; afterCommit: (fn: AfterCommit) => void }

/** Same-process fallback when the host gives no shared limiter (tests, local dev). */
const fallbackRateLimit = createMemoryRateLimitStore()

/** Every Inbox call starts here: the app must be installed. */
async function requireInstalled(context: Ctx) {
  const state = await inboxState(context.tx, context.scope.storeId)
  if (!state.installed) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Inbox app first' })
  }
  return state
}

/** An Inbox refusal ("Only active discount codes can be shared") reaches the admin as its own words. */
async function refusal<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof CommerceError) {
      const code = err.code.endsWith('NOT_FOUND') ? 'NOT_FOUND' : 'PRECONDITION_FAILED'
      throw new ORPCError(code, { message: err.message })
    }
    throw err
  }
}

const storeCtx = (context: Ctx) => ({ storeId: context.scope.storeId, tx: context.tx })

/** Publishes once the transaction commits, so a listener can always read what it hears about. */
function publishAfterCommit(context: Ctx, events: Parameters<typeof publishInboxEvents>[1]) {
  context.afterCommit(() => publishInboxEvents(context.inboxPublisher, events))
}

/** Product and discount cards also need to read what they share. */
function requireCardPermission(context: Ctx, kind: string | undefined) {
  const needed =
    kind === 'product'
      ? permissions.PRODUCTS_READ
      : kind === 'discount'
        ? permissions.DISCOUNTS_READ
        : null
  if (needed && !context.scope.can(needed)) {
    throw new ORPCError('FORBIDDEN', {
      message: kind === 'product' ? 'You need access to products' : 'You need access to discounts',
    })
  }
}

const Id = z.object({ id: z.uuid() })

/** The Inbox app: shoppers' chats, replies, assignment, quick replies, blocks and settings. */
export const inboxRouter = {
  /** How many conversations each tab holds, and how many open ones are unread. */
  counts: can(permissions.INBOX_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return inboxCounts(storeCtx(context), context.scope.userId)
  }),
  /** One page of conversations in a tab (Open, Mine, Unassigned, Closed, Blocked), newest first, with search. */
  list: can(permissions.INBOX_READ)
    .input(ListConversationsSchema)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return listConversations(storeCtx(context), input, {
        userId: context.scope.userId,
        secret: settingsSecret(),
      })
    }),
  /** One conversation with the newest page of its thread (staff notes included), or an older page. */
  get: can(permissions.INBOX_READ)
    .input(z.object({ id: z.uuid(), beforeId: z.uuid().optional() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const found = await refusal(() => getConversation(storeCtx(context), input, settingsSecret()))
      const cards = await messageCards(context.tx, found.messages)
      return { ...found, messages: found.messages.map(messageView), cards }
    }),
  /** Sends a reply or a staff-only note: text, a product card, a discount code or an image. */
  send: can(permissions.INBOX_REPLY)
    .input(StaffSendSchema)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      requireCardPermission(context, input.kind)
      const limit = await checkRateLimit(
        context.rateLimit ?? fallbackRateLimit,
        inboxLimitKey('staffPerMinute', context.scope.storeId, context.scope.userId),
        INBOX_LIMITS.staffPerMinute,
      )
      if (!limit.ok) {
        throw new ORPCError('TOO_MANY_REQUESTS', {
          message: `Too many messages. Try again in ${retryAfterSeconds(limit)} seconds.`,
        })
      }
      const sent = await refusal(() => staffSend(storeCtx(context), input, context.scope.userId))
      if (sent.created) {
        publishAfterCommit(
          context,
          messageEvents(context.scope.storeId, sent.conversation, sent.message),
        )
      }
      return { conversation: sent.conversation, message: messageView(sent.message) }
    }),
  /** Marks everything in the thread read for staff. */
  markSeen: can(permissions.INBOX_READ)
    .input(Id)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const messageId = await markStaffSeen(storeCtx(context), input.id)
      publishAfterCommit(context, seenEvents(context.scope.storeId, input.id, 'staff', messageId))
      return { ok: true }
    }),
  /** Assigns to a team member (only they are notified), or unassigns. */
  assign: can(permissions.INBOX_REPLY)
    .input(z.object({ id: z.uuid(), assigneeUserId: z.string().min(1).max(64).nullable() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const row = await refusal(() =>
        assignConversation(storeCtx(context), input, context.scope.userId),
      )
      publishAfterCommit(context, statusEvents(context.scope.storeId, row))
      return row
    }),
  /** Take a conversation over from the AI agent: it stops answering there. */
  takeOver: can(permissions.INBOX_REPLY)
    .input(Id)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const row = await refusal(() => takeOverConversation(storeCtx(context), input.id))
      publishAfterCommit(context, statusEvents(context.scope.storeId, row))
      return row
    }),
  /** Close, reopen or block a conversation; blocking also blocks the sender's browser and email. */
  setStatus: can(permissions.INBOX_REPLY)
    .input(SetStatusSchema)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const row = await refusal(() =>
        setConversationStatus(storeCtx(context), input, {
          userId: context.scope.userId,
          secret: settingsSecret(),
        }),
      )
      publishAfterCommit(context, statusEvents(context.scope.storeId, row))
      return row
    }),
  /** The customer panel: verified customer or possible match, live cart, recent orders (with orders access). */
  panel: can(permissions.INBOX_READ)
    .input(Id)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return refusal(() =>
        customerPanel(storeCtx(context), input.id, {
          ordersAllowed: context.scope.can(permissions.ORDERS_READ),
          secret: settingsSecret(),
        }),
      )
    }),
  /** Whether the thread shows AI help (suggested replies, summary): AI set up and the assistant on. */
  aiAvailable: canDetached(permissions.INBOX_READ).handler(({ context }) =>
    inboxAiAvailable(context),
  ),
  /** One to three reply drafts for the shopper's latest message. Suggests only: nothing is sent. */
  suggestReplies: canDetached(permissions.INBOX_REPLY)
    .input(Id)
    .handler(({ context, input, signal }) => suggestInboxReplies(context, input.id, signal)),
  /** A long chat in two lines: what it is about and what the shopper still waits for. */
  summarise: canDetached(permissions.INBOX_READ)
    .input(z.object({ id: z.uuid(), language: z.enum(['en', 'hi']) }))
    .handler(({ context, input, signal }) => summariseInboxChat(context, input, signal)),
  /** Team members a conversation can be assigned to. */
  assignees: can(permissions.INBOX_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return inboxAssignees(context.tx)
  }),
  /** The Inbox home's numbers for the last 30 days. */
  metrics: can(permissions.INBOX_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return inboxMetrics(storeCtx(context))
  }),
  /** Active discount codes staff may share in a chat. */
  shareableDiscounts: can(permissions.INBOX_REPLY).handler(async ({ context }) => {
    await requireInstalled(context)
    requireCardPermission(context, 'discount')
    return shareableDiscounts(context.tx)
  }),
  /** Product and discount cards for messages (the thread draws them as they are now). */
  cards: can(permissions.INBOX_READ)
    .input(
      z.object({
        messages: z.array(z.object({ kind: z.string(), payload: z.unknown() })).max(BULK_MAX),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return messageCards(context.tx, input.messages)
    }),
  /** The polling fallback: messages and changed conversations since a message id, and the counts. */
  sync: can(permissions.INBOX_READ)
    .input(z.object({ since: z.uuid().nullish() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return inboxSync(storeCtx(context), input, context.scope.userId)
    }),
  /** "Typing…" to the shopper; never stored, at most one every 3 seconds. */
  typing: can(permissions.INBOX_REPLY)
    .input(Id)
    .handler(async ({ context, input }) => {
      const limit = await checkRateLimit(
        context.rateLimit ?? fallbackRateLimit,
        inboxLimitKey('typing', context.scope.storeId, `${input.id}:staff`),
        INBOX_LIMITS.typing,
      )
      if (limit.ok) {
        publishAfterCommit(context, [typingEvent(context.scope.storeId, input.id, 'staff')])
      }
      return { ok: true }
    }),
  /** The admin stream route's check: the member may read Inbox in this store. */
  streamAccess: can(permissions.INBOX_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return { storeId: context.scope.storeId }
  }),
  quickReplies: {
    /** Saved replies, in their order. */
    list: can(permissions.INBOX_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      return listQuickReplies(storeCtx(context))
    }),
    /** Adds a saved reply with a `/shortcut`. */
    create: can(permissions.INBOX_MANAGE)
      .input(QuickReplyInputSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return refusal(() => createQuickReply(storeCtx(context), input, context.scope.userId))
      }),
    /** Changes a saved reply. */
    update: can(permissions.INBOX_MANAGE)
      .input(QuickReplyUpdateSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return refusal(() => updateQuickReply(storeCtx(context), input))
      }),
    /** Deletes a saved reply. */
    delete: can(permissions.INBOX_MANAGE)
      .input(Id)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        await refusal(() => deleteQuickReply(storeCtx(context), input.id))
        return { ok: true }
      }),
    /** Puts the saved replies in this order. */
    reorder: can(permissions.INBOX_MANAGE)
      .input(z.object({ ids: z.array(z.uuid()).max(BULK_MAX) }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        await reorderQuickReplies(storeCtx(context), input.ids)
        return { ok: true }
      }),
  },
  knowledge: {
    /** The knowledge base, its "6 of 18 published" counts and the imported Shopify facts, if any. */
    list: can(permissions.INBOX_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      const ctx = storeCtx(context)
      return {
        entries: await listKnowledge(ctx),
        counts: await knowledgeCounts(ctx),
        imported: await importedFactsSource(ctx),
      }
    }),
    /** Adds an answer. */
    create: can(permissions.INBOX_MANAGE)
      .input(KnowledgeInputSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return refusal(() => createKnowledge(storeCtx(context), input, context.scope.userId))
      }),
    /** Changes an answer. */
    update: can(permissions.INBOX_MANAGE)
      .input(KnowledgeUpdateSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return refusal(() => updateKnowledge(storeCtx(context), input))
      }),
    /** The list's publish switch. */
    setPublished: can(permissions.INBOX_MANAGE)
      .input(z.object({ id: z.uuid(), published: z.boolean() }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return refusal(() => setKnowledgePublished(storeCtx(context), input))
      }),
    /** Deletes an answer. */
    delete: can(permissions.INBOX_MANAGE)
      .input(Id)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        await refusal(() => deleteKnowledge(storeCtx(context), input.id))
        return { ok: true }
      }),
    /** Puts the answers in this order. */
    reorder: can(permissions.INBOX_MANAGE)
      .input(z.object({ ids: z.array(z.uuid()).max(BULK_MAX) }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        await reorderKnowledge(storeCtx(context), input.ids)
        return { ok: true }
      }),
    /** Copies the imported Shopify "Knowledge Base Facts" not copied before. */
    bringOver: can(permissions.INBOX_MANAGE).handler(async ({ context }) => {
      await requireInstalled(context)
      return bringOverImportedFacts(storeCtx(context), context.scope.userId)
    }),
  },
  blocks: {
    /** Blocked browsers, emails and IPs (hashes only; never the raw value). */
    list: can(permissions.INBOX_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      return listBlocks(storeCtx(context))
    }),
    /** Lifts one block. */
    remove: can(permissions.INBOX_REPLY)
      .input(Id)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        await refusal(() => removeBlock(storeCtx(context), input.id))
        return { ok: true }
      }),
  },
  settings: {
    /** Greeting, hours, away message, contact capture, sign-in, launcher, email fallback, retention. */
    get: can(permissions.INBOX_READ).handler(async ({ context }) => {
      const state = await requireInstalled(context)
      return { settings: state.settings, timeZone: state.timeZone }
    }),
    /** Saves part of the Inbox settings. */
    save: can(permissions.INBOX_MANAGE)
      .input(InboxSettingsPatchSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return saveInboxSettings(context.tx, context.scope.storeId, input)
      }),
  },
}
