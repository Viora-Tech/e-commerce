import { loadSeoHealth, loadSeoReport, permissions } from '@commerce/core'
import { loadSeoAssistant, SEO_ASSISTANT_LIMITS } from '@commerce/core/seo-assistant-service'
import { z } from 'zod'
import { can, canDetached, inputField } from '../procedures'
import { agentReadinessCheck } from '../services/agent-readiness.service'
import { applyNeeds, applySeoDrafts, draftSeoFixes } from '../services/ai/seo-assistant'

const Resource = z.enum(['product', 'collection', 'page'])

const DraftInput = z.object({
  items: z
    .array(z.object({ resource: Resource, id: z.uuid() }))
    .min(1)
    .max(SEO_ASSISTANT_LIMITS.draftMax),
})

const ApplyInput = z.object({
  changes: z
    .array(
      z.object({
        resource: Resource,
        id: z.uuid(),
        seoTitle: z.string().max(200),
        seoDescription: z.string().max(400),
      }),
    )
    .min(1)
    .max(SEO_ASSISTANT_LIMITS.applyMax),
})

/** Online store → SEO: the store's SEO score and the issues to fix, ranked by impact. */
export const seoRouter = {
  report: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadSeoReport(context.tx, context.scope.storeId),
  ),

  /**
   * Online store → SEO → Search opportunities: every product, collection and page Google showed
   * (Google Search Console app), with its searches, numbers and gaps, biggest opportunity first.
   */
  assistant: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadSeoAssistant(context.tx, context.scope.storeId),
  ),

  /**
   * "Fix with AI": drafts a search title, description and intro or FAQ per item. Nothing is
   * saved. The member must be able to edit every item asked for (products and collections:
   * products.write; pages: online_store.write).
   */
  assistantDraft: canDetached([permissions.PRODUCTS_WRITE, permissions.ONLINE_STORE_WRITE])
    .input(DraftInput)
    .handler(({ context, input, signal }) => draftSeoFixes(context, input.items, signal)),

  /** "Apply": writes the approved drafts through each item's own save, never on its own. */
  assistantApply: can(permissions.ONLINE_STORE_READ, (input) =>
    applyNeeds(inputField(input, 'changes')),
  )
    .input(ApplyInput)
    .handler(({ context, input }) =>
      applySeoDrafts(context.tx, context.scope.storeId, input.changes),
    ),

  /**
   * Settings → Store health › AI shopping agents: the store's live site checked as a browser and
   * as AI bots (GET only); null without a live domain of its own.
   */
  agentReadiness: can(permissions.SETTINGS_READ).handler(({ context }) =>
    agentReadinessCheck(context.tx, context.scope.storeId),
  ),

  /** Settings → Store health › SEO: counts of the search-listing gaps, with the first few items. */
  health: can(permissions.SETTINGS_READ).handler(({ context }) => loadSeoHealth(context.tx)),
}
