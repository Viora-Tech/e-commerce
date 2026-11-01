import {
  AI_FEATURES,
  ASSISTANT_MAX_HISTORY,
  ASSISTANT_MAX_MESSAGE,
  ASSISTANT_MAX_SELECTED,
  ASSISTANT_PAGES,
  BULK_WRITE_FIELDS,
  SEO_KEYWORD_LENGTH_MAX,
  SEO_KEYWORDS_MAX,
  ThemeOutlineSchema,
  WRITER_LANGUAGES,
  WRITER_TONES,
  WRITING_QUALITIES,
} from '@commerce/ai/client'
import {
  AiJobEmpty,
  applyAiJobItems,
  cancelAiJob,
  getAiJob,
  listAiJobs,
  permissions,
} from '@commerce/core'
import { aiStoreFacts } from '@commerce/core/ai-runtime'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { ApiContext } from '../context'
import type { StoreScope } from '../procedures'
import { BULK_MAX, can, canAny, canDetached, PAGE_SIZE_MAX, storeProcedure } from '../procedures'
import { ProposalProblem } from '../services/ai/assistant/actions/resolve'
import type { ActionEnv } from '../services/ai/assistant/actions/types'
import { getAction, listActivity } from '../services/ai/assistant/activity'
import { runAssistant } from '../services/ai/assistant/assistant'
import {
  ACTION_PERMISSIONS,
  APPROVE_PERMISSIONS,
  ASSISTANT_PERMISSIONS,
} from '../services/ai/assistant/registry'
import {
  approveAction,
  cancelAction,
  reviseAction,
  undoAction,
} from '../services/ai/assistant/service'
import { startBulkWrite } from '../services/ai/bulk.service'
import { writeProduct } from '../services/ai/product-writer'
import { suggestKeywords } from '../services/ai/seo-keywords'
import { aiSettingsView, aiStatus, saveAiSettings } from '../services/ai/settings.service'

const SeoKeywords = z
  .array(z.string().trim().min(1).max(SEO_KEYWORD_LENGTH_MAX))
  .max(SEO_KEYWORDS_MAX)
  .default([])

const SuggestKeywordsInput = z.object({
  /** The saved product, for the Search Console queries of its page; null while it is new. */
  productId: z.uuid().nullable().default(null),
  title: z.string().trim().min(1).max(255),
  productType: z.string().trim().max(255).default(''),
  vendor: z.string().trim().max(255).default(''),
  categoryId: z.string().trim().max(40).nullable().default(null),
  /** The description as plain text. */
  description: z.string().trim().max(5000).default(''),
  minPricePaise: z.number().int().min(0).nullable().default(null),
  maxPricePaise: z.number().int().min(0).nullable().default(null),
  /** Keywords the product has now, so the suggestions build on them. */
  current: SeoKeywords,
})

const WriteProductInput = z.object({
  title: z.string().trim().min(1).max(255),
  productType: z.string().trim().max(255).default(''),
  vendor: z.string().trim().max(255).default(''),
  /** What the merchant wants said: materials, who it is for, anything the photos do not show. */
  notes: z.string().trim().max(2000).default(''),
  /** The current description as plain text, so the writer improves on it rather than starting over. */
  existingDescription: z.string().trim().max(5000).default(''),
  existingTags: z.array(z.string().trim().max(60)).max(50).default([]),
  /** The product's search keywords, primary first: they steer the search title and description. */
  keywords: SeoKeywords,
  /** The product's media in gallery order; the first few photos are sent. */
  mediaIds: z.array(z.uuid()).max(20).default([]),
  tone: z.enum(WRITER_TONES).default('friendly'),
  language: z.enum(WRITER_LANGUAGES).default('en'),
})

const AssistantInput = z.object({
  message: z.string().trim().min(1).max(ASSISTANT_MAX_MESSAGE),
  /** Earlier turns of this conversation, oldest first, so follow-ups ("and last month?") work. */
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(ASSISTANT_MAX_HISTORY)
    .default([]),
  /** Where the merchant is: the page kind and the record's id (resolved under RLS, never trusted as text). */
  page: z
    .object({
      page: z.enum(ASSISTANT_PAGES),
      entityId: z.uuid().nullable().default(null),
      /** On a list: the ids of the rows ticked now (resolved under RLS like `entityId`). */
      selectedIds: z.array(z.uuid()).max(ASSISTANT_MAX_SELECTED).default([]),
    })
    .default({ page: 'other', entityId: null, selectedIds: [] }),
  language: z.enum(['en', 'hi']).default('en'),
  /**
   * In the theme editor: the open page's outline (sections, simple settings, current values),
   * so the assistant can answer about the page and propose edits to it. Data, never instructions.
   */
  theme: ThemeOutlineSchema.optional(),
})

const ActionId = z.object({ id: z.uuid() })

const BulkFields = z.array(z.enum(BULK_WRITE_FIELDS)).min(1).max(BULK_WRITE_FIELDS.length)

type ActionContext = ApiContext & {
  tx: ActionEnv['tx']
  scope: StoreScope
  session: { user: { email: string } }
}

/**
 * What an approve, edit, cancel or undo runs with: the caller's RLS transaction, who they are,
 * and their own request, so an approved `runAdminAction` calls the admin procedure as them.
 */
async function actionEnv(context: ActionContext): Promise<ActionEnv> {
  const { tx, scope, session, ...api } = context
  return {
    tx,
    storeId: scope.storeId,
    userId: scope.userId,
    email: session.user.email,
    store: await aiStoreFacts(tx, scope.storeId),
    now: new Date(),
    api,
  }
}

function problemToBadRequest<T>(work: () => Promise<T>): Promise<T> {
  return work().catch((err: unknown) => {
    if (err instanceof ProposalProblem) throw new ORPCError('BAD_REQUEST', { message: err.message })
    if (err instanceof AiJobEmpty) throw new ORPCError('BAD_REQUEST', { message: err.message })
    throw err
  })
}

export const aiRouter = {
  /**
   * Which AI buttons the caller sees. Bare `storeProcedure` on purpose (docs/guardrails.md,
   * "Router idiom"): it answers only for the calling member, booleans derived from their own
   * role, like `staff.me`, and exposes no other member's or store-wide data.
   */
  status: storeProcedure.handler(({ context }) =>
    aiStatus({ storeId: context.scope.storeId, tx: context.tx }, context.scope),
  ),

  /** Settings → AI: plan, usage this month against the quota, the switches and writing quality. */
  settings: can(permissions.SETTINGS_READ).handler(({ context }) =>
    aiSettingsView({ storeId: context.scope.storeId, tx: context.tx }),
  ),

  saveSettings: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({
        features: z.partialRecord(z.enum(AI_FEATURES), z.boolean()),
        writingQuality: z.enum(WRITING_QUALITIES).optional(),
      }),
    )
    .handler(({ context, input }) =>
      saveAiSettings({ storeId: context.scope.storeId, tx: context.tx }, input),
    ),

  /** "Write with AI" on the product page. Suggests only: nothing is saved. */
  writeProduct: canDetached(permissions.PRODUCTS_WRITE)
    .input(WriteProductInput)
    .handler(({ context, input, signal }) => writeProduct(context, input, signal)),

  /** "Suggest keywords" on the product page's Search keywords card. Suggests only: nothing is saved. */
  suggestKeywords: canDetached(permissions.PRODUCTS_WRITE)
    .input(SuggestKeywordsInput)
    .handler(({ context, input, signal }) => suggestKeywords(context, input, signal)),

  /**
   * The AI bar on every admin page: a streamed answer (oRPC event iterator). Open to a member
   * whose role allows at least one assistant tool; each tool is offered only with its own
   * permission. Change proposals are stored, never run: see `approveAction`.
   */
  assistant: canDetached(ASSISTANT_PERMISSIONS)
    .input(AssistantInput)
    .handler(({ context, input, signal }) =>
      runAssistant({ ...context, email: context.session.user.email }, input, signal),
    ),

  /**
   * Approve on a proposal card: runs it as the caller, with their permission for that action.
   * The asker's own proposal, or (from an MCP client) the owner's or a permitted member's.
   */
  approveAction: canAny(APPROVE_PERMISSIONS)
    .input(ActionId)
    .handler(async ({ context, input }) =>
      approveAction(await actionEnv(context), context.scope, input.id),
    ),

  /** Edit on a proposal card: the merchant's changes, checked like the model's input. */
  reviseAction: canAny(APPROVE_PERMISSIONS)
    .input(
      z.object({
        id: z.uuid(),
        changes: z.record(
          z.string().max(40),
          z.union([z.string().max(5000), z.number(), z.null()]),
        ),
      }),
    )
    .handler(({ context, input }) =>
      problemToBadRequest(async () =>
        reviseAction(await actionEnv(context), context.scope, input.id, input.changes),
      ),
    ),

  cancelAction: canAny(APPROVE_PERMISSIONS)
    .input(ActionId)
    .handler(async ({ context, input }) =>
      cancelAction(await actionEnv(context), context.scope, input.id),
    ),

  /** Undo from the card or Settings → AI → Activity, with the action's own permission. */
  undoAction: canAny(ACTION_PERMISSIONS)
    .input(ActionId)
    .handler(async ({ context, input }) =>
      undoAction(await actionEnv(context), context.scope, input.id),
    ),

  /** One AI action with its card, for "Open approval" from the MCP & API activity log. */
  action: canAny(ACTION_PERMISSIONS)
    .input(ActionId)
    .handler(async ({ context, input }) => {
      const view = await getAction({ storeId: context.scope.storeId, tx: context.tx }, input.id)
      if (!view) throw new ORPCError('NOT_FOUND', { message: 'That AI action was not found.' })
      return view
    }),

  /** Settings → AI → Activity: every AI action in the store, newest first. */
  activity: can(permissions.SETTINGS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(20),
      }),
    )
    .handler(({ context, input }) =>
      listActivity({ storeId: context.scope.storeId, tx: context.tx }, input),
    ),

  /** Bulk "Write with AI" on the products list: starts a worker run, returns its progress. */
  bulkWrite: canDetached(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        productIds: z.array(z.uuid()).min(1).max(BULK_MAX),
        fields: BulkFields,
        language: z.enum(WRITER_LANGUAGES).default('en'),
        tone: z.enum(WRITER_TONES).default('friendly'),
      }),
    )
    .handler(({ context, input }) => problemToBadRequest(() => startBulkWrite(context, input))),

  bulkJob: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const job = await getAiJob({ storeId: context.scope.storeId, tx: context.tx }, input.id)
      if (!job) throw new ORPCError('NOT_FOUND', { message: 'That AI run was not found.' })
      return job
    }),

  bulkJobs: can(permissions.PRODUCTS_WRITE).handler(({ context }) =>
    listAiJobs({ storeId: context.scope.storeId, tx: context.tx }),
  ),

  cancelBulk: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => ({
      cancelled: await cancelAiJob({ storeId: context.scope.storeId, tx: context.tx }, input.id),
    })),

  /** Applies the reviewed suggestions to products; logged in Activity with an undo. */
  applyBulk: can(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        jobId: z.uuid(),
        itemIds: z.array(z.uuid()).min(1).max(BULK_MAX),
        fields: BulkFields,
      }),
    )
    .handler(({ context, input }) =>
      applyAiJobItems(
        { storeId: context.scope.storeId, tx: context.tx },
        { ...input, userId: context.scope.userId },
      ),
    ),
}
