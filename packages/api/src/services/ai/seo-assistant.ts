/**
 * "Fix with AI" on Online store › SEO › Search opportunities: for one product, collection or
 * page (or a selection, up to `SEO_ASSISTANT_LIMITS.draftMax`), a new search title (≤60
 * characters), search description (≤155) and an 80–150 word intro or FAQ, written from the
 * item's own words and the real Google searches it is shown for. Nothing is saved here: the
 * admin shows the drafts beside the current listing and `applySeoDrafts` writes only what the
 * merchant approved. Runs under the product writer's switch and allowance (Settings → AI), one
 * call per item; an item the model fails on comes back as failed, the rest still arrive.
 * No customer data is sent.
 */
import {
  type AiFeature,
  generateStructured,
  SeoDraftSchema,
  seoAssistantContent,
  seoAssistantInstructions,
} from '@commerce/ai'
import { patchProductFields, updateCollection } from '@commerce/core'
import type { Permission } from '@commerce/core/permissions'
import {
  applyPermissions,
  clampSeoDraft,
  SEO_APPLY_PERMISSION,
  SEO_ASSISTANT_LIMITS,
  type SeoApplyChange,
  type SeoAssistantResource,
  type SeoDraft,
  seoApplyPlan,
  seoDraftFacts,
} from '@commerce/core/seo-assistant-service'
import { type StoreTx, withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { updatePage } from '../page.service'
import { type AiCallContext, finishAiCall, startAiCall } from './guard'

/** The feature whose switch and allowance the drafts count against. */
const FEATURE: AiFeature = 'productWriter'

export type SeoDraftRef = { resource: SeoAssistantResource; id: string }

export type SeoDraftResult =
  | ({ ok: true } & SeoDraftRef & SeoDraft & { queries: number })
  | ({ ok: false } & SeoDraftRef & { reason: 'not_found' | 'model_failed' })

/** Refuses when the member could not save one of the items anyway. */
function assertMayEdit(can: (p: Permission) => boolean, resources: SeoAssistantResource[]): void {
  const missing = applyPermissions(resources).filter((p) => !can(p))
  if (missing.length) {
    throw new ORPCError('FORBIDDEN', {
      message: 'Your role cannot edit some of these items, so it cannot fix their search listing.',
      data: { reason: 'permission', permissions: missing },
    })
  }
}

export async function draftSeoFixes(
  context: AiCallContext,
  refs: SeoDraftRef[],
  signal?: AbortSignal,
): Promise<SeoDraftResult[]> {
  const { storeId } = context.scope
  assertMayEdit(
    context.scope.can,
    refs.map((r) => r.resource),
  )
  const picked = refs.slice(0, SEO_ASSISTANT_LIMITS.draftMax)
  const facts = await withStore(context.db, storeId, (tx) => seoDraftFacts(tx, storeId, picked))
  const out: SeoDraftResult[] = []
  for (const ref of picked) {
    const f = facts.find((x) => x.resource === ref.resource && x.id === ref.id)
    if (!f) {
      out.push({ ok: false, ...ref, reason: 'not_found' })
      continue
    }
    // Checked per item: the allowance or the burst limit may run out half way.
    const call = await startAiCall(context, FEATURE)
    try {
      const { output, usage } = await generateStructured({
        runtime: call.runtime,
        model: call.model,
        schema: SeoDraftSchema,
        instructions: seoAssistantInstructions(SEO_ASSISTANT_LIMITS),
        content: seoAssistantContent({
          resource: f.resource,
          title: f.title,
          seoTitle: f.seoTitle,
          seoDescription: f.seoDescription,
          bodyText: f.bodyText,
          vendor: f.vendor,
          productType: f.productType,
          minPricePaise: f.minPricePaise,
          maxPricePaise: f.maxPricePaise,
          queries: f.queries,
        }),
        abortSignal: signal,
      })
      await finishAiCall(context.db, call, usage)
      out.push({ ok: true, ...ref, ...clampSeoDraft(output), queries: f.queries.length })
    } catch {
      out.push({ ok: false, ...ref, reason: 'model_failed' })
    }
  }
  return out
}

/** The permissions an Apply needs, read from its input before the schema (for `can(…, also)`). */
export function applyNeeds(changes: unknown): Permission[] {
  if (!Array.isArray(changes)) return []
  const resources = changes
    .map((c) => (c && typeof c === 'object' ? (c as { resource?: unknown }).resource : null))
    .filter((r): r is SeoAssistantResource => typeof r === 'string' && r in SEO_APPLY_PERMISSION)
  return applyPermissions(resources)
}

/**
 * Writes the approved search titles and descriptions through each item's own save: the product
 * fields AI may change, the collection patch, the page update. Returns how many items changed.
 */
export async function applySeoDrafts(
  tx: StoreTx,
  storeId: string,
  changes: SeoApplyChange[],
): Promise<{ applied: number }> {
  const plan = seoApplyPlan(changes)
  let applied = plan.products.length ? await patchProductFields(tx, storeId, plan.products) : 0
  for (const c of plan.collections) {
    await updateCollection(tx, storeId, c.id, c.write)
    applied++
  }
  for (const p of plan.pages) {
    if (await updatePage(tx, storeId, p.id, p.input)) applied++
  }
  return { applied }
}
