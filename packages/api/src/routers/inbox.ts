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
  createQuickReply,
  deleteQuickReply,
  getConversation,
  INBOX_LIMITS,
  InboxSettingsPatchSchema,
  inboxCounts,
  inboxLimitKey,
  inboxState,
  ListConversationsSchema,
  listBlocks,
  listConversations,
  listQuickReplies,
  markStaffSeen,
  messageView,
  QuickReplyInputSchema,
  QuickReplyUpdateSchema,
  removeBlock,
  reorderQuickReplies,
  SetStatusSchema,
  StaffSendSchema,
  saveInboxSettings,
  setConversationStatus,
  staffSend,
  updateQuickReply,
} from '@commerce/core/inbox/server'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { ApiContext } from '../context'
import { BULK_MAX, can, type StoreScope } from '../procedures'

type Ctx = ApiContext & { tx: StoreTx; scope: StoreScope }

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
      return { ...found, messages: found.messages.map(messageView) }
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
      return { conversation: sent.conversation, message: messageView(sent.message) }
    }),
  /** Marks everything in the thread read for staff. */
  markSeen: can(permissions.INBOX_READ)
    .input(Id)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      await markStaffSeen(storeCtx(context), input.id)
      return { ok: true }
    }),
  /** Assigns to a team member (only they are notified), or unassigns. */
  assign: can(permissions.INBOX_REPLY)
    .input(z.object({ id: z.uuid(), assigneeUserId: z.string().min(1).max(64).nullable() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return refusal(() => assignConversation(storeCtx(context), input, context.scope.userId))
    }),
  /** Close, reopen or block a conversation; blocking also blocks the sender's browser and email. */
  setStatus: can(permissions.INBOX_REPLY)
    .input(SetStatusSchema)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return refusal(() =>
        setConversationStatus(storeCtx(context), input, {
          userId: context.scope.userId,
          secret: settingsSecret(),
        }),
      )
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
