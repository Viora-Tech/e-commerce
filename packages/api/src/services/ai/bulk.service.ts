/**
 * Bulk "Write with AI" (products list → select → Write with AI): starts a run for many
 * products as a worker job, so the request returns at once and the list shows progress. Each
 * product is one AI call, admitted and metered by the runner against the store's allowance;
 * the burst rate limit counts the start only, because the worker paces the run (one product
 * at a time per store). Nothing is saved to products until the merchant reviews and applies.
 */
import {
  type AiBulkQueue,
  type AiJobOptions,
  type AiJobView,
  cancelAiJob,
  createAiJob,
  getAiJob,
  loadAiSettings,
} from '@commerce/core'
import { runAiJob } from '@commerce/core/ai-runtime'
import { withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { type AiCallContext, checkAiAvailable, refusal } from './guard'

export type BulkStartInput = AiJobOptions & { productIds: string[] }

export async function startBulkWrite(
  context: AiCallContext & { aiBulk?: AiBulkQueue | undefined },
  input: BulkStartInput,
): Promise<AiJobView> {
  const { storeId, userId } = context.scope
  await checkAiAvailable(context)
  const job = await withStore(context.db, storeId, async (tx) => {
    const settings = await loadAiSettings({ storeId, tx })
    if (!settings.features.bulkWriter) throw refusal({ reason: 'feature_off' })
    return createAiJob(
      { storeId, tx },
      {
        userId,
        productIds: input.productIds,
        options: { fields: input.fields, language: input.language, tone: input.tone },
      },
    )
  })
  if (context.aiBulk) {
    // BullMQ refuses a custom id with one ':' in it, so the id is joined with '-'.
    await context.aiBulk
      .add(
        'run',
        { storeId, jobId: job.id },
        { jobId: `ai-bulk-${job.id}`, attempts: 2, removeOnComplete: true },
      )
      .catch(async (err: unknown) => {
        // Never leave a run "waiting to start" that no worker will pick up.
        await withStore(context.db, storeId, (tx) => cancelAiJob({ storeId, tx }, job.id))
        throw err
      })
  } else {
    // No worker queue (tests): run it here, the same way the worker does.
    await runAiJob({ db: context.db, storeId, jobId: job.id })
  }
  const view = await withStore(context.db, storeId, (tx) => getAiJob({ storeId, tx }, job.id))
  if (!view) throw new ORPCError('NOT_FOUND', { message: 'That AI run was not found.' })
  return view
}
