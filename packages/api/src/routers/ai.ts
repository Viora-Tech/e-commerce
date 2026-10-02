import {
  AI_FEATURES,
  ASK_MAX_HISTORY,
  ASK_MAX_QUESTION,
  WRITER_LANGUAGES,
  WRITER_TONES,
} from '@commerce/ai/client'
import { permissions } from '@commerce/core'
import { z } from 'zod'
import { can, canDetached, storeProcedure } from '../procedures'
import { askStore } from '../services/ai/ask-store'
import { writeProduct } from '../services/ai/product-writer'
import { aiSettingsView, aiStatus, saveAiSettings } from '../services/ai/settings.service'

const WriteProductInput = z.object({
  title: z.string().trim().min(1).max(255),
  productType: z.string().trim().max(255).default(''),
  vendor: z.string().trim().max(255).default(''),
  /** What the merchant wants said: materials, who it is for, anything the photos do not show. */
  notes: z.string().trim().max(2000).default(''),
  /** The current description as plain text, so the writer improves on it rather than starting over. */
  existingDescription: z.string().trim().max(5000).default(''),
  existingTags: z.array(z.string().trim().max(60)).max(50).default([]),
  /** The product's media in gallery order; the first few photos are sent. */
  mediaIds: z.array(z.uuid()).max(20).default([]),
  tone: z.enum(WRITER_TONES).default('friendly'),
  language: z.enum(WRITER_LANGUAGES).default('en'),
})

const AskInput = z.object({
  question: z.string().trim().min(1).max(ASK_MAX_QUESTION),
  /** Earlier turns of this conversation, oldest first, so follow-ups ("and last month?") work. */
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(ASK_MAX_HISTORY)
    .default([]),
  language: z.enum(['en', 'hi']).default('en'),
})

export const aiRouter = {
  /**
   * Which AI buttons the caller sees. Bare `storeProcedure` on purpose (docs/guardrails.md,
   * "Router idiom"): it answers only for the calling member, three booleans derived from
   * their own role, like `staff.me`, and exposes no other member's or store-wide data.
   */
  status: storeProcedure.handler(({ context }) =>
    aiStatus({ storeId: context.scope.storeId, tx: context.tx }, context.scope),
  ),

  /** Settings → AI: plan, usage this month against the quota, and the feature switches. */
  settings: can(permissions.SETTINGS_READ).handler(({ context }) =>
    aiSettingsView({ storeId: context.scope.storeId, tx: context.tx }),
  ),

  saveSettings: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ features: z.partialRecord(z.enum(AI_FEATURES), z.boolean()) }))
    .handler(({ context, input }) =>
      saveAiSettings({ storeId: context.scope.storeId, tx: context.tx }, input.features),
    ),

  /** "Write with AI" on the product page. Suggests only: nothing is saved. */
  writeProduct: canDetached(permissions.PRODUCTS_WRITE)
    .input(WriteProductInput)
    .handler(({ context, input, signal }) => writeProduct(context, input, signal)),

  /** "Ask your store" on Home: a streamed answer from read-only store data. */
  ask: canDetached(permissions.ANALYTICS_READ)
    .input(AskInput)
    .handler(({ context, input, signal }) => askStore(context, input, signal)),
}
