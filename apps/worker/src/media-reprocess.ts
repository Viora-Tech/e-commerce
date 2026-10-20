/**
 * `bun run media:reprocess [--store <slug>] [--concurrency <n>]`
 *
 * Backfill: runs the upload-time pipeline (`processImage`) over media that
 * never went through it — legacy rows from before this feature, Shopify
 * import images whose enqueue failed (the run lists them as issues), and
 * anything stuck `processing` after a worker restart or `failed` after its
 * retries were exhausted. Safe to re-run: each row is
 * picked up by the same `status`/`variants IS NULL` query that decides it
 * still needs work, so a run interrupted partway through (Ctrl-C, the box
 * restarting) just continues where it left off next time, in createdAt/id
 * order (batched with `LIMIT`, never `OFFSET`, so rows already fixed in this
 * run drop out of the next batch's `WHERE` on their own — no page to skip).
 *
 * `--concurrency <n>` (default 2, max 8) works on that many rows of a batch at once, each in
 * its own `withStore` transaction; a failed row is marked `failed` and the others go on.
 * `processImage` (sharp) is CPU-bound, so set it to about the server's cores.
 */
import { loadEnv } from '@commerce/config'
import { markMediaFailed, markMediaProcessed, storageForStore } from '@commerce/core'
import { processImage } from '@commerce/core/media-pipeline'
import { registriesForStore } from '@commerce/core/registries'
import { createDb, media, store, withStore } from '@commerce/db'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { forEachLimit, parseConcurrency } from './media-concurrency'

const BATCH = 10

function parseArgs(argv: string[]): { storeSlug: string | null; concurrency: number } {
  const idx = argv.indexOf('--store')
  return {
    storeSlug: idx !== -1 ? (argv[idx + 1] ?? null) : null,
    concurrency: parseConcurrency(argv),
  }
}

const needsProcessing = or(
  eq(media.status, 'processing'),
  eq(media.status, 'failed'),
  and(eq(media.status, 'ready'), isNull(media.variants), sql`${media.contentType} like 'image/%'`),
)

async function storeIdsToProcess(db: ReturnType<typeof createDb>, slug: string | null) {
  if (slug) {
    const [s] = await db.select({ id: store.id }).from(store).where(eq(store.slug, slug))
    return s ? [s.id] : []
  }
  const rows = await db
    .selectDistinct({ storeId: media.storeId })
    .from(media)
    .where(needsProcessing)
  return rows.map((r) => r.storeId)
}

async function main() {
  const env = loadEnv(process.env)
  const { storeSlug, concurrency } = parseArgs(process.argv.slice(2))
  const db = createDb(env.DATABASE_URL)

  const storeIds = await storeIdsToProcess(db, storeSlug)
  if (storeIds.length === 0) {
    console.log(
      storeSlug ? `store "${storeSlug}" has nothing to reprocess` : 'nothing to reprocess',
    )
    return
  }

  let done = 0
  let failed = 0
  for (const storeId of storeIds) {
    let batch: { id: string; key: string | null; contentType: string | null }[]
    do {
      batch = await withStore(db, storeId, (tx) =>
        tx
          .select({ id: media.id, key: media.key, contentType: media.contentType })
          .from(media)
          .where(needsProcessing)
          .limit(BATCH),
      )
      // One `withStore` transaction per row, never shared, so rows in flight stay independent.
      await forEachLimit(batch, concurrency, async (row) => {
        if (!row.key) {
          done += 1
          return
        }
        try {
          await withStore(db, storeId, async (tx) => {
            const { storage } = await registriesForStore(tx, storeId)
            const provider = await storageForStore(tx, storeId, storage, env.SETTINGS_SECRET)
            const bytes = await provider.get(row.key as string)
            if (!bytes) throw new Error(`object missing at ${row.key}`)
            const result = await processImage({
              bytes,
              contentType: row.contentType ?? 'image/jpeg',
              masterKey: row.key as string,
            })
            await provider.put(result.master)
            if (result.master.key !== row.key) await provider.delete(row.key as string)
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
            await markMediaProcessed(tx, row.id, {
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
          done += 1
        } catch (err) {
          failed += 1
          const message = err instanceof Error ? err.message : String(err)
          console.warn(`[media:reprocess] ${storeId}/${row.id} failed: ${message}`)
          await withStore(db, storeId, (tx) => markMediaFailed(tx, row.id, message)).catch(
            (markErr) =>
              console.warn(`[media:reprocess] ${storeId}/${row.id} not marked: ${markErr}`),
          )
        }
      })
    } while (batch.length === BATCH)
  }

  console.log(`[media:reprocess] done=${done} failed=${failed}`)
  await db.$client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
