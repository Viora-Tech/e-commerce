import { markMediaFailed, markMediaProcessed, storageForStore } from '@commerce/core'
import { DecompressionBombError, processImage } from '@commerce/core/media-pipeline'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, media, withStore } from '@commerce/db'
import {
  type IORedis,
  MEDIA_PROCESS_QUEUE,
  type MediaProcessJob,
  Queue,
  Worker,
} from '@commerce/queue'
import { eq } from 'drizzle-orm'

/** Two jobs at once, at most: the whole point of this pipeline (see docs/) is to protect a small 2-vCPU box, not to race through a backlog. */
export const MEDIA_PROCESS_CONCURRENCY = 2

/**
 * One job per confirmed image upload (or Shopify-import media row): loads
 * the object, runs the upload-time pipeline (`processImage`), writes the
 * cleaned master and every AVIF/WebP variant back to the same storage
 * provider, then flips the row to `ready` with the real dimensions,
 * `variants` map and ThumbHash.
 *
 * The cleaned master **replaces the original at its existing key** — the
 * original is never left in the bucket under a second key — so a GPS-tagged
 * upload is only ever briefly reachable at its public URL, between confirm
 * and this job finishing, and never again after. Idempotent: re-running the
 * same job (a retry, the backfill script) re-downloads the current object at
 * that key, re-derives the same variant keys and overwrites them — safe even
 * if a previous attempt got partway through.
 *
 * `DecompressionBombError` and any other pipeline error mark the row
 * `failed` after BullMQ's own retries (5, exponential backoff — see
 * `enqueueMediaProcess`) are exhausted, rather than looping forever, and delete
 * the unprocessed object; the admin media library shows a failed row and lets the
 * merchant delete it.
 */
export function createMediaProcessWorker(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string },
) {
  const queue = new Queue<MediaProcessJob>(MEDIA_PROCESS_QUEUE, { connection })
  const worker = new Worker<MediaProcessJob>(
    MEDIA_PROCESS_QUEUE,
    async (job) => {
      const { storeId, mediaId } = job.data
      await withStore(db, storeId, async (tx) => {
        const [row] = await tx.select().from(media).where(eq(media.id, mediaId))
        if (!row) return // deleted before the job ran; nothing to do
        if (!row.key) return // no object key (e.g. an already-imported row referencing someone else's CDN)

        const { storage } = await registriesForStore(tx, storeId)
        const provider = await storageForStore(tx, storeId, storage, opts.settingsSecret)

        const bytes = await provider.get(row.key)
        if (!bytes) throw new Error(`object missing at ${row.key}`)

        const result = await processImage({
          bytes,
          contentType: row.contentType ?? 'image/jpeg',
          masterKey: row.key,
        })

        await provider.put(result.master)
        // Animated GIF gets a new key (`.gif` -> `.webp`, see pipeline.ts); the
        // original at the old key would otherwise sit in the bucket, GPS and
        // all, forever. Delete it once the cleaned master is safely written.
        if (result.master.key !== row.key) await provider.delete(row.key)
        for (const v of result.variants) {
          await provider.put(v.avif)
          await provider.put(v.webp)
        }

        const variants = Object.fromEntries(
          result.variants.map((v) => [
            String(v.width),
            { avif: provider.publicUrl(v.avif.key), webp: provider.publicUrl(v.webp.key) },
          ]),
        )

        await markMediaProcessed(tx, mediaId, {
          url: provider.publicUrl(result.master.key),
          key: result.master.key,
          provider: provider.id,
          contentType: result.master.contentType,
          size: result.master.body.byteLength,
          width: result.width,
          height: result.height,
          variants,
          thumbhash: result.thumbhash,
        })
      })
    },
    { connection, concurrency: MEDIA_PROCESS_CONCURRENCY },
  )

  worker.on('failed', async (job, err) => {
    const maxAttempts = job?.opts.attempts ?? 1
    if (!job || job.attemptsMade < maxAttempts) return // more retries queued; not final yet
    const isBomb = err instanceof DecompressionBombError
    const message = isBomb
      ? `rejected: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err)
    try {
      await withStore(db, job.data.storeId, async (tx) => {
        // The unprocessed original (GPS and all, or bytes that were never an image) must
        // not stay public at its URL: the row stays, failed, for the merchant to delete.
        const [row] = await tx.select().from(media).where(eq(media.id, job.data.mediaId))
        if (row?.key) {
          const { storage } = await registriesForStore(tx, job.data.storeId)
          const provider = await storageForStore(tx, job.data.storeId, storage, opts.settingsSecret)
          await provider.delete(row.key).catch(() => undefined)
        }
        await markMediaFailed(tx, job.data.mediaId, message)
      })
    } catch (markErr) {
      console.error(`[media] could not mark ${job.data.mediaId} failed`, markErr)
    }
  })

  return { queue, worker }
}
