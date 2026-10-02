/** SOURCE OF TRUTH: running a bulk AI run — WHAT works through a "Write with AI" run one product at a time: admit and meter each call, send the product's facts and photos, store the clamped suggestion / WHY the worker (and the API in tests) run bulk AI the same way, never holding a transaction open while a model thinks */
import {
  aiModel,
  clampProductCopy,
  descriptionText,
  generateStructured,
  ProductCopySchema,
  productWriterContent,
  productWriterInstructions,
} from '@commerce/ai'
import { aiJob, aiJobItem, type Db, product, withStore } from '@commerce/db'
import { and, asc, eq } from 'drizzle-orm'
import type { AiJobOptions } from './jobs'
import { refreshAiJobCounts } from './jobs'
import { writerPhotos } from './photos'
import { productPhotoIds } from './product-fields'
import { admitAiCall } from './quota'
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

/**
 * Works through a run until it is finished, cancelled or out of allowance. Each product is
 * one admitted, metered call; reads and writes each take their own short transaction.
 */
export async function runAiJob(opts: RunAiJobOptions): Promise<void> {
  for (;;) {
    if (opts.signal?.aborted) return
    const next = await claimNext(opts)
    if (!next) return
    const { item, options, userId } = next
    const admission = await withStore(opts.db, opts.storeId, (tx) =>
      admitAiCall({ storeId: opts.storeId, tx }, 'bulkWriter'),
    )
    if (!admission.ok) {
      await finishItem(opts, item.id, { error: STOPPED[admission.reason] })
      await stopRun(opts, admission.reason)
      return
    }
    const model = aiModel('bulkWriter', process.env, admission.tier)
    if (!model) {
      await finishItem(opts, item.id, { error: STOPPED.ai_off })
      await stopRun(opts, 'ai_off')
      return
    }
    const facts = await withStore(opts.db, opts.storeId, async (tx) => {
      const [row] = await tx
        .select({
          title: product.title,
          productType: product.productType,
          vendor: product.vendor,
          description: product.description,
          tags: product.tags,
        })
        .from(product)
        .where(eq(product.id, item.productId))
      const photoIds = (await productPhotoIds(tx, [item.productId])).get(item.productId) ?? []
      const photos = await writerPhotos(tx, opts.storeId, photoIds, opts.settingsSecret)
      return row ? { row, photos } : null
    })
    if (!facts) {
      await finishItem(opts, item.id, { error: 'This product no longer exists.' })
      continue
    }
    try {
      const { output, usage } = await generateStructured({
        runtime: { storeId: opts.storeId, userId, plan: admission.plan, feature: 'bulkWriter' },
        model,
        schema: ProductCopySchema,
        instructions: productWriterInstructions({ tone: options.tone, language: options.language }),
        content: productWriterContent(
          {
            title: facts.row.title,
            productType: facts.row.productType ?? '',
            vendor: facts.row.vendor ?? '',
            notes: '',
            existingDescription: descriptionText(facts.row.description).slice(0, 5000),
            existingTags: facts.row.tags.slice(0, 50),
          },
          facts.photos,
        ),
        abortSignal: opts.signal,
      })
      await withStore(opts.db, opts.storeId, (tx) =>
        recordAiUsage(
          { storeId: opts.storeId, tx },
          { month: admission.month, feature: 'bulkWriter', ...usage },
        ),
      ).catch(() => undefined)
      await finishItem(opts, item.id, { suggestion: clampProductCopy(output) })
    } catch {
      await finishItem(opts, item.id, { error: 'The AI writer could not finish this product.' })
    }
  }
}
