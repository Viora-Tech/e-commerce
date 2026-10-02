/** SOURCE OF TRUTH: bulk AI runs (ai_job, ai_job_item) and applying their suggestions — WHAT creates a "Write with AI" run for many products, reports its progress, and applies the reviewed suggestions with an undo record / WHY the products list, the API and the worker share one job model */
import {
  type BulkWriteField,
  clampProductCopy,
  descriptionFromCopy,
  newTags,
  type ProductCopy,
  ProductCopySchema,
  type WriterLanguage,
  type WriterTone,
} from '@commerce/ai/client'
import {
  type AiJobItemStatus,
  type AiJobStatus,
  aiAction,
  aiJob,
  aiJobItem,
  product,
} from '@commerce/db'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import {
  type ProductFieldsPatch,
  type ProductFieldsSnapshot,
  patchProductFields,
  productFieldsSnapshot,
} from './product-fields'

/** Queue the worker reads bulk AI runs from. Braces keep every key on one slot. */
export const AI_BULK_QUEUE = '{ai}-bulk-write'

export type AiBulkJob = { storeId: string; jobId: string }

export type AiBulkQueue = {
  add(
    name: string,
    data: AiBulkJob,
    opts?: {
      jobId?: string
      attempts?: number
      removeOnComplete?: boolean
      removeOnFail?: boolean
    },
  ): Promise<unknown>
}

export type AiJobOptions = { fields: BulkWriteField[]; language: WriterLanguage; tone: WriterTone }

/** No product in the run was found in this store (or every one was a system fixture). */
export class AiJobEmpty extends CommerceError {
  constructor(storeId: string) {
    super('AI_JOB_EMPTY', 'None of those products were found.', { storeId })
  }
}

/** Creates a queued run over the store's own products, in the order given. */
export async function createAiJob(
  ctx: StoreContext,
  input: { userId: string; productIds: string[]; options: AiJobOptions },
): Promise<{ id: string; total: number }> {
  const ids = [...new Set(input.productIds)]
  const rows = ids.length
    ? await ctx.tx
        .select({ id: product.id })
        .from(product)
        .where(and(inArray(product.id, ids), eq(product.isSystemTest, false)))
    : []
  const found = new Set(rows.map((r) => r.id))
  const ordered = ids.filter((id) => found.has(id))
  if (!ordered.length) throw new AiJobEmpty(ctx.storeId)
  const [job] = await ctx.tx
    .insert(aiJob)
    .values({
      storeId: ctx.storeId,
      userId: input.userId,
      options: input.options,
      total: ordered.length,
    })
    .returning({ id: aiJob.id })
  const jobId = job?.id as string
  await ctx.tx.insert(aiJobItem).values(
    ordered.map((productId, position) => ({
      storeId: ctx.storeId,
      jobId,
      productId,
      position,
    })),
  )
  return { id: jobId, total: ordered.length }
}

export type AiJobItemView = {
  id: string
  productId: string
  title: string
  status: AiJobItemStatus
  error: string | null
  suggestion: ProductCopy | null
  /** What the product has now, for the review's before and after. */
  current: { seoTitle: string | null; seoDescription: string | null; tags: string[] }
}

export type AiJobView = {
  id: string
  status: AiJobStatus
  options: AiJobOptions
  total: number
  done: number
  failed: number
  error: string | null
  createdAt: Date
  finishedAt: Date | null
  items: AiJobItemView[]
}

function parseSuggestion(raw: unknown): ProductCopy | null {
  const parsed = ProductCopySchema.safeParse(raw)
  return parsed.success ? clampProductCopy(parsed.data) : null
}

/** A run with every item and its suggestion, or null when it is not this store's. */
export async function getAiJob(ctx: StoreContext, id: string): Promise<AiJobView | null> {
  const [job] = await ctx.tx.select().from(aiJob).where(eq(aiJob.id, id))
  if (!job) return null
  const items = await ctx.tx
    .select({
      id: aiJobItem.id,
      productId: aiJobItem.productId,
      status: aiJobItem.status,
      error: aiJobItem.error,
      suggestion: aiJobItem.suggestion,
      title: product.title,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      tags: product.tags,
    })
    .from(aiJobItem)
    .innerJoin(product, eq(product.id, aiJobItem.productId))
    .where(eq(aiJobItem.jobId, id))
    .orderBy(asc(aiJobItem.position))
  return {
    id: job.id,
    status: job.status,
    options: job.options as AiJobOptions,
    total: job.total,
    done: job.done,
    failed: job.failed,
    error: job.error,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      title: item.title,
      status: item.status,
      error: item.error,
      suggestion: parseSuggestion(item.suggestion),
      current: { seoTitle: item.seoTitle, seoDescription: item.seoDescription, tags: item.tags },
    })),
  }
}

export type AiJobSummary = Omit<AiJobView, 'items' | 'options'> & {
  fields: BulkWriteField[]
  /** Suggestions written and not applied yet: what is left to review. */
  ready: number
}

/** The store's latest runs, newest first. */
export async function listAiJobs(ctx: StoreContext, limit = 5): Promise<AiJobSummary[]> {
  const rows = await ctx.tx
    .select({
      job: aiJob,
      ready: sql<number>`(select count(*)::int from ${aiJobItem} where ${aiJobItem.jobId} = ${aiJob.id} and ${aiJobItem.status} = 'ready')`,
    })
    .from(aiJob)
    .orderBy(desc(aiJob.createdAt))
    .limit(limit)
  return rows.map(({ job, ready }) => ({
    ready,
    id: job.id,
    status: job.status,
    total: job.total,
    done: job.done,
    failed: job.failed,
    error: job.error,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    fields: (job.options as AiJobOptions).fields ?? [],
  }))
}

/** Stops a run: products not written yet are skipped. Finished runs are left alone. */
export async function cancelAiJob(ctx: StoreContext, id: string): Promise<boolean> {
  const [job] = await ctx.tx
    .update(aiJob)
    .set({ status: 'cancelled', finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(aiJob.id, id), inArray(aiJob.status, ['queued', 'running'])))
    .returning({ id: aiJob.id })
  if (!job) return false
  await ctx.tx
    .update(aiJobItem)
    .set({ status: 'skipped', updatedAt: new Date() })
    .where(and(eq(aiJobItem.jobId, id), eq(aiJobItem.status, 'pending')))
  return true
}

/** The product patch for one suggestion and the fields the merchant kept. */
function patchFromSuggestion(
  copy: ProductCopy,
  fields: BulkWriteField[],
  current: ProductFieldsSnapshot,
): ProductFieldsPatch {
  const patch: ProductFieldsPatch = {}
  if (fields.includes('description')) patch.description = descriptionFromCopy(copy, true)
  if (fields.includes('seo')) {
    if (copy.seoTitle) patch.seoTitle = copy.seoTitle
    if (copy.seoDescription) patch.seoDescription = copy.seoDescription
  }
  if (fields.includes('tags')) {
    const added = newTags(current.tags, copy.tags)
    if (added.length) patch.tags = [...current.tags, ...added]
  }
  if (fields.includes('altText') && copy.altTexts.length) {
    patch.mediaAlt = current.mediaAlt
      .slice(0, copy.altTexts.length)
      .map((m, i) => ({ mediaId: m.mediaId, alt: copy.altTexts[i] ?? m.alt }))
  }
  return patch
}

export type AppliedAiJob = { applied: number; actionId: string | null }

/**
 * Applies reviewed suggestions to their products and logs one executed `ai_action` with the
 * products' previous fields, so Settings → AI → Activity can undo it.
 */
export async function applyAiJobItems(
  ctx: StoreContext,
  input: { jobId: string; itemIds: string[]; fields: BulkWriteField[]; userId: string },
): Promise<AppliedAiJob> {
  if (!input.itemIds.length || !input.fields.length) return { applied: 0, actionId: null }
  const items = await ctx.tx
    .select({
      id: aiJobItem.id,
      productId: aiJobItem.productId,
      suggestion: aiJobItem.suggestion,
    })
    .from(aiJobItem)
    .where(
      and(
        eq(aiJobItem.jobId, input.jobId),
        inArray(aiJobItem.id, input.itemIds),
        eq(aiJobItem.status, 'ready'),
      ),
    )
  const snapshots = await productFieldsSnapshot(
    ctx.tx,
    items.map((i) => i.productId),
  )
  const patches = items.flatMap((item) => {
    const copy = parseSuggestion(item.suggestion)
    const before = snapshots.find((s) => s.productId === item.productId)
    return copy && before
      ? [{ productId: item.productId, patch: patchFromSuggestion(copy, input.fields, before) }]
      : []
  })
  if (!patches.length) return { applied: 0, actionId: null }
  const applied = await patchProductFields(ctx.tx, ctx.storeId, patches)
  await ctx.tx
    .update(aiJobItem)
    .set({ status: 'applied', updatedAt: new Date() })
    .where(
      inArray(
        aiJobItem.id,
        items.map((i) => i.id),
      ),
    )
  const now = new Date()
  const titles = await ctx.tx
    .select({ title: product.title })
    .from(product)
    .where(
      inArray(
        product.id,
        patches.map((p) => p.productId),
      ),
    )
    .limit(5)
  const [action] = await ctx.tx
    .insert(aiAction)
    .values({
      storeId: ctx.storeId,
      userId: input.userId,
      source: 'bulkWriter',
      tool: 'applyProductCopy',
      status: 'executed',
      summary:
        applied === 1
          ? 'Write with AI: applied to 1 product'
          : `Write with AI: applied to ${applied} products`,
      input: { jobId: input.jobId, itemIds: input.itemIds, fields: input.fields },
      preview: {
        rows: titles.map((t) => ({ label: t.title, before: '', after: input.fields.join(', ') })),
        more: Math.max(0, patches.length - titles.length),
      },
      result: { applied },
      undo: {
        kind: 'productFields',
        snapshots: snapshots.filter((s) => patches.some((p) => p.productId === s.productId)),
      },
      approvedBy: input.userId,
      approvedAt: now,
      executedAt: now,
      expiresAt: now,
    })
    .returning({ id: aiAction.id })
  return { applied, actionId: action?.id ?? null }
}

/** Progress counters, recomputed from the items (cheap: one run has at most 200). */
export async function refreshAiJobCounts(ctx: StoreContext, jobId: string): Promise<void> {
  await ctx.tx
    .update(aiJob)
    .set({
      done: sql`(select count(*)::int from ${aiJobItem} where ${aiJobItem.jobId} = ${jobId} and ${aiJobItem.status} in ('ready', 'applied'))`,
      failed: sql`(select count(*)::int from ${aiJobItem} where ${aiJobItem.jobId} = ${jobId} and ${aiJobItem.status} = 'failed')`,
      updatedAt: new Date(),
    })
    .where(eq(aiJob.id, jobId))
}
