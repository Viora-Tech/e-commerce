/**
 * `bun run media:videos [--store <slug>]`
 *
 * Backfill for smaller video copies (`./video-compact.ts`): makes the copy for every video in Files
 * that has none yet, one at a time (an encode uses about two cores). Videos uploaded before the
 * worker made copies, and any whose job never ran, are picked up. Safe to re-run and to stop
 * part way: a video with a copy is skipped, and one whose copy was not smaller is tried again
 * (cheap to skip by hand with `--store`). Stores are found with the owner login
 * (`DATABASE_URL_OWNER`), as in `media-reprocess.ts`; rows are read and saved per store.
 */
import { loadEnv } from '@commerce/config'
import { isCompactableVideo } from '@commerce/core'
import { createDb, media, store, withStore } from '@commerce/db'
import { and, asc, eq, isNotNull, isNull, like } from 'drizzle-orm'
import { compactVideo } from './video-compact'

function storeSlugArg(argv: string[]): string | null {
  const at = argv.indexOf('--store')
  return at >= 0 ? (argv[at + 1] ?? null) : null
}

const needsCopy = and(like(media.contentType, 'video/%'), isNull(media.compactUrl), isNotNull(media.key))

async function main() {
  const env = loadEnv(process.env)
  const slug = storeSlugArg(process.argv.slice(2))
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
        const result = await compactVideo(db, storeId, row.id, env.SETTINGS_SECRET)
        if (result === 'made') made++
        console.log(`${row.id} ${result}`)
      } catch (err) {
        failed++
        console.error(`${row.id} failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
  await db.$client.end()
  console.log(`done: ${made} copies made, ${failed} failed`)
}

await main()
