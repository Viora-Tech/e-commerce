/**
 * `bun run media:videos [--store <slug>] [--force]`
 *
 * By-hand run of the smaller video copies (`./video-compact.ts`). The worker does this on its own
 * (`./media-video.ts`: on upload, and an hourly backfill sweep); this is for running it now, on a
 * laptop or a box without the worker. One video at a time (an encode uses about two cores).
 * Safe to re-run and to stop part way: a video already looked at (a copy, or `compact_size` 0
 * for one that keeps its original) is skipped. `--force` (with `--store`) looks at that store's
 * videos again, failed and not-smaller ones included. A video without a poster gets its
 * first-frame poster (`./video-poster.ts`) in the same run, so a plain run is also the backfill
 * of posters for videos uploaded before them (25 Nov 2026); its copy is not made again.
 * Stores are found with the owner login (`DATABASE_URL_OWNER`), as in `media-reprocess.ts`;
 * rows are read and saved per store.
 */
import { loadEnv } from '@commerce/config'
import { isCompactableVideo } from '@commerce/core'
import { createDb, media, store, withStore } from '@commerce/db'
import { and, asc, eq, isNotNull, isNull, like, or } from 'drizzle-orm'
import { compactVideo } from './video-compact'

function storeSlugArg(argv: string[]): string | null {
  const at = argv.indexOf('--store')
  return at >= 0 ? (argv[at + 1] ?? null) : null
}

const notLookedAt = and(
  like(media.contentType, 'video/%'),
  or(isNull(media.compactSize), isNull(media.posterMediaId)),
  isNotNull(media.key),
)
const anyVideo = and(like(media.contentType, 'video/%'), isNotNull(media.key))

async function main() {
  const env = loadEnv(process.env)
  const slug = storeSlugArg(process.argv.slice(2))
  const force = process.argv.includes('--force')
  if (force && !slug) throw new Error('--force needs --store <slug>')
  const needsCopy = force ? anyVideo : notLookedAt
  const owner = createDb(env.DATABASE_URL_OWNER)
  const stores = slug
    ? await owner.select({ id: store.id }).from(store).where(eq(store.slug, slug))
    : await owner.selectDistinct({ id: media.storeId }).from(media).where(needsCopy)
  await owner.$client.end()
  if (stores.length === 0) {
    console.log(slug ? `store "${slug}" not found or has no videos` : 'no videos need a copy')
    return
  }

  const db = createDb(env.DATABASE_URL)
  let made = 0
  let posters = 0
  let failed = 0
  for (const { id: storeId } of stores) {
    const rows = await withStore(db, storeId, (tx) =>
      tx
        .select({ id: media.id, contentType: media.contentType, size: media.size })
        .from(media)
        .where(needsCopy)
        .orderBy(asc(media.createdAt)),
    )
    for (const row of rows.filter((r) => isCompactableVideo(r.contentType))) {
      try {
        const result = await compactVideo(db, storeId, row.id, env.SETTINGS_SECRET, { force })
        if (result === 'made') made++
        if (result === 'poster') posters++
        console.log(`${row.id} ${result}`)
      } catch (err) {
        failed++
        console.error(`${row.id} failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
  await db.$client.end()
  console.log(`done: ${made} copies made, ${posters} posters only, ${failed} failed`)
}

await main()
