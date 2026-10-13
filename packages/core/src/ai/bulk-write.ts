/** SOURCE OF TRUTH: running a bulk AI run — WHAT works through a "Write with AI" run one product at a time: admit and meter each call, suggest search keywords when asked, send the product's facts, photos and keywords to the writer, store the clamped suggestion / WHY the worker (and the API in tests) run bulk AI the same way, never holding a transaction open while a model thinks */
import {
  type AiModel,
  type AiUsage,
  aiModel,
  clampKeywords,
  clampProductCopy,
  descriptionText,
  generateStructured,
  keywordList,
  type ProductCopy,
  ProductCopySchema,
  productWriterContent,
  productWriterInstructions,
  SeoKeywordsSchema,
  type SuggestedKeyword,
  seoKeywordsContent,
  seoKeywordsInstructions,
  writesCopy,
} from '@commerce/ai'
import { aiJob, aiJobItem, type Db, product, withStore } from '@commerce/db'
import { and, asc, eq } from 'drizzle-orm'
import { productKeywordFacts } from '../seo/keywords'
import type { AiJobOptions } from './jobs'
import { refreshAiJobCounts } from './jobs'
import { writerPhotos } from './photos'
import { productPhotoIds } from './product-fields'
import { type AiAdmission, admitAiCall } from './quota'
import { recordAiUsage } from './usage'

export type RunAiJobOptions = {
  db: Db
  storeId: string
  jobId: string
  /** Decrypts the store's storage settings to read photos; read from the env when omitted. */
  settingsSecret?: string | undefined
  signal?: AbortSignal | undefined
}

const STOPPED: Record<'feature_off' | 'quota' | 'ai_off', string> = {
  ai_off: 'AI is not switched on for this platform.',
  feature_off: 'Bulk "Write with AI" is turned off in Settings → AI.',
  quota: "Your store has used this month's AI allowance.",
}

/** Fails what is left of a run with one reason (AI off, switched off, out of allowance). */
async function stopRun(opts: RunAiJobOptions, reason: keyof typeof STOPPED): Promise<void> {
  await withStore(opts.db, opts.storeId, async (tx) => {
    await tx
      .update(aiJobItem)
      .set({ status: 'failed', error: STOPPED[reason], updatedAt: new Date() })
      .where(and(eq(aiJobItem.jobId, opts.jobId), eq(aiJobItem.status, 'pending')))
    await refreshAiJobCounts({ storeId: opts.storeId, tx }, opts.jobId)
    await tx
      .update(aiJob)
      .set({
        status: 'failed',
        error: STOPPED[reason],
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiJob.id, opts.jobId))
  })
}

/** Takes the next pending item, or null when the run is finished or was cancelled. */
async function claimNext(opts: RunAiJobOptions) {
  return withStore(opts.db, opts.storeId, async (tx) => {
    const [job] = await tx.select().from(aiJob).where(eq(aiJob.id, opts.jobId))
    if (!job || job.status === 'cancelled' || job.status === 'done' || job.status === 'failed') {
      return null
    }
    const [item] = await tx
      .select({ id: aiJobItem.id, productId: aiJobItem.productId })
      .from(aiJobItem)
      .where(and(eq(aiJobItem.jobId, opts.jobId), eq(aiJobItem.status, 'pending')))
      .orderBy(asc(aiJobItem.position))
      .limit(1)
    if (!item) {
      await refreshAiJobCounts({ storeId: opts.storeId, tx }, opts.jobId)
      await tx
        .update(aiJob)
        .set({ status: 'done', finishedAt: new Date(), updatedAt: new Date() })
        .where(eq(aiJob.id, opts.jobId))
      return null
    }
    if (job.status === 'queued') {
      await tx
        .update(aiJob)
        .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
        .where(eq(aiJob.id, opts.jobId))
    }
    await tx
      .update(aiJobItem)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(aiJobItem.id, item.id))
    return { item, options: job.options as AiJobOptions, userId: job.userId }
  })
}

async function finishItem(
  opts: RunAiJobOptions,
  itemId: string,
  outcome: { suggestion: unknown } | { error: string },
): Promise<void> {
  await withStore(opts.db, opts.storeId, async (tx) => {
    await tx
      .update(aiJobItem)
      .set(
        'error' in outcome
          ? { status: 'failed', error: outcome.error, updatedAt: new Date() }
          : { status: 'ready', suggestion: outcome.suggestion, error: null, updatedAt: new Date() },
      )
      .where(eq(aiJobItem.id, itemId))
    await refreshAiJobCounts({ storeId: opts.storeId, tx }, opts.jobId)
  })
}

type AdmittedCall = { admission: Extract<AiAdmission, { ok: true }>; model: AiModel }

/** Admits and counts one call, or fails the item, stops the run and returns null. */
async function admitCall(opts: RunAiJobOptions, itemId: string): Promise<AdmittedCall | null> {
  const admission = await withStore(opts.db, opts.storeId, (tx) =>
    admitAiCall({ storeId: opts.storeId, tx }, 'bulkWriter'),
  )
  if (!admission.ok) {
    await finishItem(opts, itemId, { error: STOPPED[admission.reason] })
    await stopRun(opts, admission.reason)
    return null
  }
  const model = aiModel('bulkWriter', process.env, admission.tier)
  if (!model) {
    await finishItem(opts, itemId, { error: STOPPED.ai_off })
    await stopRun(opts, 'ai_off')
    return null
  }
  return { admission, model }
}

/** Adds a call's tokens to the store's month. Never throws: metering must not fail a product. */
async function meter(opts: RunAiJobOptions, month: string, usage: AiUsage): Promise<void> {
  await withStore(opts.db, opts.storeId, (tx) =>
    recordAiUsage({ storeId: opts.storeId, tx }, { month, feature: 'bulkWriter', ...usage }),
  ).catch(() => undefined)
}

/** The product's facts for this run: its row and photos for the copy, and keyword facts. */
async function loadFacts(opts: RunAiJobOptions, productId: string, options: AiJobOptions) {
  return withStore(opts.db, opts.storeId, async (tx) => {
    const [row] = await tx
      .select({
        title: product.title,
        productType: product.productType,
        vendor: product.vendor,
        description: product.description,
        tags: product.tags,
        seoKeywords: product.seoKeywords,
      })
      .from(product)
      .where(eq(product.id, productId))
    if (!row) return null
    const photoIds = writesCopy(options.fields)
      ? ((await productPhotoIds(tx, [productId])).get(productId) ?? [])
      : []
    const photos = await writerPhotos(tx, opts.storeId, photoIds, opts.settingsSecret)
    const keywordFacts = options.fields.includes('keywords')
      ? await productKeywordFacts(tx, opts.storeId, productId)
      : null
    return { row, photos, keywordFacts }
  })
}

/**
 * Works through a run until it is finished, cancelled or out of allowance. Each product is
 * one admitted, metered call per part (keywords, then the copy, which uses the product's own
 * keywords or, when it has none, the ones just suggested); reads and writes each take their
 * own short transaction.
 */
export async function runAiJob(opts: RunAiJobOptions): Promise<void> {
  for (;;) {
    if (opts.signal?.aborted) return
    const next = await claimNext(opts)
    if (!next) return
    const { item, options, userId } = next
    const facts = await loadFacts(opts, item.productId, options)
    if (!facts) {
      await finishItem(opts, item.id, { error: 'This product no longer exists.' })
      continue
    }
    try {
      let keywords: SuggestedKeyword[] | null = null
      if (facts.keywordFacts) {
        const call = await admitCall(opts, item.id)
        if (!call) return
        const { output, usage } = await generateStructured({
          runtime: {
            storeId: opts.storeId,
            userId,
            plan: call.admission.plan,
            feature: 'bulkWriter',
          },
          model: call.model,
          schema: SeoKeywordsSchema,
          instructions: seoKeywordsInstructions(),
          content: seoKeywordsContent(facts.keywordFacts),
          abortSignal: opts.signal,
        })
        await meter(opts, call.admission.month, usage)
        const seen = facts.keywordFacts.searchQueries.map((q) => q.query)
        keywords = clampKeywords(output, seen)
      }
      let copy: ProductCopy | null = null
      if (writesCopy(options.fields)) {
        const call = await admitCall(opts, item.id)
        if (!call) return
        const steering = facts.row.seoKeywords.length
          ? facts.row.seoKeywords
          : keywordList(keywords ?? [])
        const { output, usage } = await generateStructured({
          runtime: {
            storeId: opts.storeId,
            userId,
            plan: call.admission.plan,
            feature: 'bulkWriter',
          },
          model: call.model,
          schema: ProductCopySchema,
          instructions: productWriterInstructions({
            tone: options.tone,
            language: options.language,
          }),
          content: productWriterContent(
            {
              title: facts.row.title,
              productType: facts.row.productType ?? '',
              vendor: facts.row.vendor ?? '',
              notes: '',
              existingDescription: descriptionText(facts.row.description).slice(0, 5000),
              existingTags: facts.row.tags.slice(0, 50),
              keywords: steering,
            },
            facts.photos,
          ),
          abortSignal: opts.signal,
        })
        await meter(opts, call.admission.month, usage)
        copy = clampProductCopy(output)
      }
      if (!copy && !keywords?.length) {
        await finishItem(opts, item.id, { error: 'The AI suggested no keywords for this product.' })
        continue
      }
      await finishItem(opts, item.id, {
        suggestion: { ...copy, ...(keywords?.length ? { keywords } : {}) },
      })
    } catch {
      await finishItem(opts, item.id, { error: 'The AI writer could not finish this product.' })
    }
  }
}
