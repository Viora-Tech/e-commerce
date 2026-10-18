/**
 * `bun run media:rehost --store <slug> [--dry-run]`
 *
 * Repair after a store's bucket moved: media rows still point at the old public URL, whose
 * objects may be gone. For every row of the store whose `url` is not under the store's current
 * storage, the Shopify import's mapping gives the source URL; the source is downloaded again,
 * goes through the upload-time pipeline (`processImage`, same as `media:reprocess`) and is
 * stored under the same key in the current bucket, and the row gets the new URLs. Product and
 * collection descriptions that mention the old base are rewritten to the new one.
 *
 * Rows with no import source (a direct upload) cannot be fetched again: they are listed, not
 * changed. `--dry-run` only counts. Safe to re-run: a fixed row is under the current base and
 * drops out of the query.
 */
import { loadEnv } from '@commerce/config'
import { markMediaProcessed, storageForStore } from '@commerce/core'
import { processImage } from '@commerce/core/media-pipeline'
import { registriesForStore } from '@commerce/core/registries'
import { safeFetch } from '@commerce/core/safe-fetch'
import { collection, createDb, media, product, store, withStore } from '@commerce/db'
import { importMapping } from '@commerce/plugin-shopify-import/schema'
import { and, eq, isNotNull, sql } from 'drizzle-orm'

const SAMPLE_KEY = '__base__'

function parseArgs(argv: string[]) {
  const idx = argv.indexOf('--store')
  return { slug: idx !== -1 ? (argv[idx + 1] ?? null) : null, dryRun: argv.includes('--dry-run') }
}

/** `https://cdn.example/a/b.jpg` minus its key: the part every URL of this bucket starts with. */
const baseOf = (url: string, key: string) => (url.endsWith(key) ? url.slice(0, -key.length) : null)

async function main() {
  const env = loadEnv(process.env)
  const { slug, dryRun } = parseArgs(process.argv.slice(2))
  if (!slug) throw new Error('usage: media:rehost --store <slug> [--dry-run]')
  const db = createDb(env.DATABASE_URL)
  // The app role only sees a store inside `withStore`; finding one by slug needs the owner.
  const owner = createDb(env.DATABASE_URL_OWNER)
  const [s] = await owner.select({ id: store.id }).from(store).where(eq(store.slug, slug))
  await owner.$client.end()
  if (!s) throw new Error(`no store "${slug}"`)
  const storeId = s.id

  const provider = await withStore(db, storeId, async (tx) => {
    const { storage } = await registriesForStore(tx, storeId)
    return storageForStore(tx, storeId, storage, env.SETTINGS_SECRET)
  })
  const newBase = baseOf(provider.publicUrl(SAMPLE_KEY), SAMPLE_KEY)
  if (!newBase) throw new Error('cannot tell the current public base URL')

  const rows = await withStore(db, storeId, (tx) =>
    tx
      .select({
        id: media.id,
        url: media.url,
        key: media.key,
        contentType: media.contentType,
        variants: media.variants,
        source: importMapping.sourceId,
      })
      .from(media)
      .leftJoin(
        importMapping,
        and(eq(importMapping.resource, 'media'), eq(importMapping.localId, media.id)),
      )
      .where(and(isNotNull(media.key), sql`${media.url} not like ${`${newBase}%`}`)),
  )
  const oldBases = new Set(rows.map((r) => baseOf(r.url, r.key as string)).filter(Boolean))
  const noSource = rows.filter((r) => !r.source)
  console.log(
    `[media:rehost] store=${slug} current=${newBase} stale=${rows.length} ` +
      `fetchable=${rows.length - noSource.length} noSource=${noSource.length} ` +
      `oldBases=${[...oldBases].join(',') || '-'}`,
  )
  for (const r of noSource) console.log(`  no import source: ${r.id} ${r.key}`)
  if (dryRun) {
    await db.$client.end()
    return
  }

  let done = 0
  let failed = 0
  let moved = 0
  for (const row of rows) {
    if (!row.key) continue
    const key = row.key
    // The object is already in the current bucket (only the public URL changed, e.g.
    // r2.dev to a custom domain): point the row at it, nothing to download.
    const oldBase = baseOf(row.url, key)
    if (oldBase && (await provider.head(key).catch(() => null))) {
      const rebase = (url: string) =>
        url.startsWith(oldBase) ? `${newBase}${url.slice(oldBase.length)}` : url
      const variants = row.variants
        ? Object.fromEntries(
            Object.entries(row.variants).map(([width, v]) => [
              width,
              { avif: rebase(v.avif), webp: rebase(v.webp) },
            ]),
          )
        : null
      await withStore(db, storeId, (tx) =>
        tx
          .update(media)
          .set({ url: rebase(row.url), variants, provider: provider.id })
          .where(eq(media.id, row.id)),
      )
      moved += 1
      continue
    }
    if (!row.source) continue
    try {
      const res = await safeFetch(row.source, { allowHttp: true, timeoutMs: 60_000 })
      if (!res.ok) throw new Error(`source answered ${res.status}`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      const contentType =
        row.contentType ?? res.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
      await withStore(db, storeId, async (tx) => {
        if (!contentType.startsWith('image/')) {
          await provider.put({ key, body: bytes, contentType })
          await tx
            .update(media)
            .set({ url: provider.publicUrl(key), provider: provider.id, status: 'ready' })
            .where(eq(media.id, row.id))
          return
        }
        const result = await processImage({ bytes, contentType, masterKey: key })
        await provider.put(result.master)
        for (const v of result.variants) {
          await provider.put(v.avif)
          await provider.put(v.webp)
        }
        await markMediaProcessed(tx, row.id, {
          url: provider.publicUrl(result.master.key),
          key: result.master.key,
          provider: provider.id,
          contentType: result.master.contentType,
          size: result.master.body.byteLength,
          width: result.width,
          height: result.height,
          variants: Object.fromEntries(
            result.variants.map((v) => [
              String(v.width),
              { avif: provider.publicUrl(v.avif.key), webp: provider.publicUrl(v.webp.key) },
            ]),
          ),
          thumbhash: result.thumbhash,
        })
      })
      done += 1
      if (done % 25 === 0) console.log(`[media:rehost] ${done}/${rows.length}`)
    } catch (err) {
      failed += 1
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[media:rehost] ${row.id} failed: ${message}`)
    }
  }

  // Descriptions keep image URLs inside their rich text: point them at the new base.
  let descriptions = 0
  await withStore(db, storeId, async (tx) => {
    for (const oldBase of oldBases) {
      if (!oldBase) continue
      for (const table of [product, collection]) {
        const changed = await tx
          .update(table)
          .set({
            description: sql`replace(${table.description}::text, ${oldBase}, ${newBase})::jsonb`,
          })
          .where(sql`${table.description}::text like ${`%${oldBase}%`}`)
          .returning({ id: table.id })
        descriptions += changed.length
      }
    }
  })

  console.log(
    `[media:rehost] done=${done} moved=${moved} failed=${failed} descriptions=${descriptions}`,
  )
  await db.$client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
