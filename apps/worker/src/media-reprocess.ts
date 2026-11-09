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
 * `--own-size` also redoes ready images that lack a copy at their own width (added with
 * `variantWidthsFor`): before it, a photo narrower than the next standard width, or wider than
 * 1920, fell back to the PNG/JPEG original. Each row gains that copy once, so a rerun skips it.
 *
 * Stores are found with the owner login (`DATABASE_URL_OWNER`): the app login sees no rows until
 * a store is set, so a run without it always said "nothing to reprocess". Rows go most-used first
 * (the photos shoppers see), progress prints every 10 rows, and a row that fails is not retried in
 * the same run. A row that only lacks its own-width copy gets just that copy
 * (`encodeVariantWidth`), not every width again.
 *
 * `--concurrency <n>` (default 2, max 8) works on that many rows of a batch at once, each in
 * its own `withStore` transaction; a failed row is marked `failed` and the others go on.
 * `processImage` (sharp) is CPU-bound, so set it to about the server's cores.
 */
import { loadEnv } from '@commerce/config'
import { markMediaFailed, markMediaProcessed, mediaUseCount, storageForStore } from '@commerce/core'
import { encodeVariantWidth, processImage } from '@commerce/core/media-pipeline'
import { registriesForStore } from '@commerce/core/registries'
import { createDb, media, store, withStore } from '@commerce/db'
import { and, asc, count, desc, eq, isNull, notInArray, or, sql } from 'drizzle-orm'
import { forEachLimit, parseConcurrency } from './media-concurrency'

const BATCH = 10

function parseArgs(argv: string[]): {
  storeSlug: string | null
  concurrency: number
  ownSize: boolean
} {
  const idx = argv.indexOf('--store')
  return {
    storeSlug: idx !== -1 ? (argv[idx + 1] ?? null) : null,
    concurrency: parseConcurrency(argv),
    ownSize: argv.includes('--own-size'),
  }
}

const unprocessed = or(
  eq(media.status, 'processing'),
  eq(media.status, 'failed'),
  and(eq(media.status, 'ready'), isNull(media.variants), sql`${media.contentType} like 'image/%'`),
)

/** Ready still images whose copies stop short of their own width (animated GIFs keep their own). */
const missingOwnSize = and(
  eq(media.status, 'ready'),
  sql`${media.contentType} like 'image/%'`,
  sql`${media.contentType} not in ('image/gif', 'image/svg+xml')`,
  sql`${media.variants} is not null`,
  sql`${media.width} is not null`,
  sql`not (${media.variants} ? (${media.width})::text)`,
)

let needsProcessing = unprocessed

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

type Row = {
  id: string
  key: string | null
  contentType: string | null
  width: number | null
  variants: Record<string, { avif: string; webp: string }> | null
}

/** Only the own-width copy is missing: the cheap path applies. */
const onlyOwnSizeMissing = (row: Row): row is Row & { width: number; key: string } =>
  row.key !== null &&
  row.width !== null &&
  row.variants !== null &&
  Object.keys(row.variants).length > 0 &&
  !(String(row.width) in row.variants) &&
  !['image/gif', 'image/svg+xml'].includes(row.contentType ?? '')

async function main() {
  const env = loadEnv(process.env)
  const { storeSlug, concurrency, ownSize } = parseArgs(process.argv.slice(2))
  if (ownSize) needsProcessing = or(unprocessed, missingOwnSize)
  const db = createDb(env.DATABASE_URL)
  const owner = createDb(env.DATABASE_URL_OWNER)

  const storeIds = await storeIdsToProcess(owner, storeSlug)
  await owner.$client.end()
  if (storeIds.length === 0) {
    console.log(
      storeSlug ? `store "${storeSlug}" has nothing to reprocess` : 'nothing to reprocess',
    )
    await db.$client.end()
    return
  }

  let done = 0
  let failed = 0
  for (const storeId of storeIds) {
    const [{ total } = { total: 0 }] = await withStore(db, storeId, (tx) =>
      tx.select({ total: count() }).from(media).where(needsProcessing),
    )
    console.log(`[media:reprocess] store ${storeId}: ${total} to do`)
    let storeDone = 0
    const report = () => {
      storeDone += 1
      if (storeDone % 10 === 0 || storeDone === total) {
        console.log(`[media:reprocess] ${storeDone}/${total} done, ${failed} failed`)
      }
    }
    // Rows tried in this run, so a row that keeps failing is not picked up again and again.
    const tried: string[] = []
    let batch: Row[]
    do {
      batch = await withStore(db, storeId, (tx) =>
        tx
          .select({
            id: media.id,
            key: media.key,
            contentType: media.contentType,
            width: media.width,
            variants: sql<Row['variants']>`${media.variants}`,
          })
          .from(media)
          .where(tried.length ? and(needsProcessing, notInArray(media.id, tried)) : needsProcessing)
          .orderBy(desc(mediaUseCount), asc(media.createdAt), asc(media.id))
          .limit(BATCH),
      )
      for (const r of batch) tried.push(r.id)
      // One `withStore` transaction per row, never shared, so rows in flight stay independent.
      await forEachLimit(batch, concurrency, async (row) => {
        if (!row.key) {
          done += 1
          report()
          return
        }
        try {
          await withStore(db, storeId, async (tx) => {
            const { storage } = await registriesForStore(tx, storeId)
            const provider = await storageForStore(tx, storeId, storage, env.SETTINGS_SECRET)
            const bytes = await provider.get(row.key as string)
            if (!bytes) throw new Error(`object missing at ${row.key}`)
            if (onlyOwnSizeMissing(row)) {
              const copy = await encodeVariantWidth({ bytes, masterKey: row.key, width: row.width })
              await provider.put(copy.avif)
              await provider.put(copy.webp)
              await tx
                .update(media)
                .set({
                  variants: {
                    ...row.variants,
                    [String(copy.width)]: {
                      avif: provider.publicUrl(copy.avif.key),
                      webp: provider.publicUrl(copy.webp.key),
                    },
                  },
                })
                .where(eq(media.id, row.id))
              return
            }
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
        report()
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
