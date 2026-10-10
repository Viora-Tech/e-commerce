import { saveImageForProcessing } from '@commerce/core'
import { type LookupAll, readCapped, safeFetch } from '@commerce/core/safe-fetch'
import type { StoreTx } from '@commerce/db'
import type { AppHookContext } from '@commerce/plugins'
import { isAllowedContentType, isImageContentType, maxUploadBytesFor } from '@commerce/storage'
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import { reviewMedia } from './schema'

/** The copy job's name (`enqueueAppJob` with `pluginId: 'reviews'`). */
export const COPY_PHOTOS_JOB = 'copy-photos'

/** Photos fetched per batch; the job keeps going until none are left. */
const BATCH = 25
/** One job stops after this long; what is left is picked up by the next import or a re-run. */
const JOB_BUDGET_MS = 10 * 60_000

export type CopyDeps = { fetch?: typeof fetch | undefined; lookup?: LookupAll | undefined }

async function download(url: string, deps: CopyDeps) {
  const res = await safeFetch(url, {
    timeoutMs: 20_000,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
    ...(deps.lookup ? { lookup: deps.lookup } : {}),
  })
  if (!res.ok) {
    await res.body?.cancel()
    throw new Error(`download failed (${res.status})`)
  }
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!isAllowedContentType(contentType) || !isImageContentType(contentType)) {
    await res.body?.cancel()
    throw new Error(`${contentType || 'unknown type'} is not an image we accept`)
  }
  const bytes = await readCapped(res, maxUploadBytesFor(contentType))
  if (!bytes) throw new Error('image is too large')
  return { bytes, contentType }
}

const pending = (tx: StoreTx) =>
  tx
    .select({ id: reviewMedia.id, sourceUrl: reviewMedia.sourceUrl })
    .from(reviewMedia)
    .where(
      and(
        isNull(reviewMedia.mediaId),
        isNotNull(reviewMedia.sourceUrl),
        isNull(reviewMedia.copyError),
      ),
    )
    .orderBy(asc(reviewMedia.createdAt))
    .limit(BATCH)

/**
 * Copies imported review photos (Judge.me's CDN addresses) into the store's Files: each
 * address is fetched through the SSRF-guarded `safeFetch` (public hosts only, redirects
 * re-checked, bytes capped at the upload limit), saved like an upload and queued for the
 * media pipeline, which strips location data. A photo that cannot be copied keeps its
 * error and is never shown. Idempotent: copied rows have a media id and are skipped.
 */
export async function copyReviewPhotos(
  ctx: Pick<AppHookContext, 'storeId' | 'inStore' | 'storage' | 'log' | 'processMedia'>,
  deps: CopyDeps = {},
  now: () => number = Date.now,
): Promise<{ copied: number; failed: number }> {
  const started = now()
  const storage = await ctx.storage()
  let copied = 0
  let failed = 0
  for (;;) {
    if (now() - started > JOB_BUDGET_MS) break
    const batch = await ctx.inStore(pending)
    if (batch.length === 0) break
    for (const row of batch) {
      try {
        const file = await download(row.sourceUrl ?? '', deps)
        const name = new URL(row.sourceUrl ?? '').pathname.split('/').pop() || 'review-photo'
        const saved = await ctx.inStore(async (tx) => {
          const s = await saveImageForProcessing(tx, ctx.storeId, storage, {
            filename: name,
            contentType: file.contentType,
            bytes: file.bytes,
          })
          await tx.update(reviewMedia).set({ mediaId: s.mediaId }).where(eq(reviewMedia.id, row.id))
          return s
        })
        copied += 1
        // Saved already: a queue hiccup leaves it `processing` for `media:reprocess`.
        await ctx.processMedia?.(saved.mediaId).catch((err: unknown) => {
          ctx.log(`photo ${saved.mediaId} not queued for processing: ${String(err)}`)
        })
      } catch (err) {
        failed += 1
        const message = err instanceof Error ? err.message : String(err)
        await ctx.inStore((tx) =>
          tx
            .update(reviewMedia)
            .set({ copyError: message.slice(0, 300) })
            .where(eq(reviewMedia.id, row.id)),
        )
      }
    }
  }
  ctx.log(`review photos: ${copied} copied, ${failed} failed`)
  return { copied, failed }
}
