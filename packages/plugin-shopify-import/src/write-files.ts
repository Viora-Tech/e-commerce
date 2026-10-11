/**
 * Shopify Files → our media library, through the same media host as product
 * images: one download per source URL, images queued for the optimising
 * pipeline, mp4 video stored as is. What the library cannot hold yet (PDFs and
 * other documents, YouTube links, 3D models, videos over the limit) stays in
 * Shopify and is listed in the report.
 */
import { isAllowedContentType } from '@commerce/storage'
import type { LeftBehindReason } from './client'
import type { FilesTally } from './file-usage'
import { IMPORT_VIDEO_MAX_BYTES, sizeText } from './limits'
import { mediaSourceKey } from './media'
import { errorMessage, findMapping, type ImportContext, saveMapping } from './runtime'
import type { NFile } from './types'

/** What a Shopify file becomes: our media id, or why it stays behind. */
export type HostedFile =
  | { ok: true; mediaId: string }
  | { ok: false; reason: LeftBehindReason; detail?: string | undefined; message: string }

/** Plain name for a content type in the report: `application/pdf` → `PDF`. */
function fileKindName(mimeType: string | null): string {
  if (!mimeType) return 'other'
  const sub = mimeType.split('/')[1] ?? mimeType
  if (sub === 'pdf') return 'PDF'
  if (mimeType.startsWith('image/')) return `${sub.replace(/\+xml$/, '').toUpperCase()} image`
  if (mimeType.startsWith('video/')) return `${sub.toUpperCase()} video`
  return sub.replace(/^vnd\.|^x-/, '').slice(0, 40)
}

/** A video's line in the preview: its size is what the merchant weighs before importing. */
function videoDetail(f: NFile): string {
  return f.size ? `Video, ${sizeText(f.size)}` : 'Video'
}

/** Why a file cannot be copied, before downloading anything. Null when it can. */
function whyNotHostable(f: NFile): Exclude<HostedFile, { ok: true }> | null {
  if (f.status !== 'READY') {
    return {
      ok: false,
      reason: 'file_not_ready',
      message: `Shopify has not finished processing this file (${f.status.toLowerCase()})`,
    }
  }
  if (f.kind === 'external_video') {
    return {
      ok: false,
      reason: 'external_video',
      message: `A YouTube or Vimeo link (${f.url ?? 'no address'}); add it to a section by its link`,
    }
  }
  if (f.kind === 'model_3d') {
    return { ok: false, reason: 'model_3d', message: '3D models are not supported yet' }
  }
  if (f.kind === 'video' && !f.url) {
    return f.mimeType && f.mimeType !== 'video/mp4'
      ? {
          ok: false,
          reason: 'file_type',
          detail: fileKindName(f.mimeType),
          message: `Shopify has no mp4 copy of this ${fileKindName(f.mimeType)}`,
        }
      : {
          ok: false,
          reason: 'video_too_large',
          message: `Every mp4 copy of this video is over the ${sizeText(IMPORT_VIDEO_MAX_BYTES)} limit`,
        }
  }
  if (!f.url) {
    return { ok: false, reason: 'file_not_ready', message: 'Shopify gave no address for this file' }
  }
  if (f.kind === 'file' && !(f.mimeType && isAllowedContentType(f.mimeType))) {
    return {
      ok: false,
      reason: 'file_type',
      detail: fileKindName(f.mimeType),
      message: `${fileKindName(f.mimeType)} files are not supported in Files yet. Download it from ${f.url}`,
    }
  }
  return null
}

/** The name a theme refers to a Shopify file by, as the mapping key. */
const nameKey = (f: NFile) => f.filename?.trim().toLowerCase() || null

/**
 * Records the file's Shopify name (`intro.mp4`) against our media row (resource
 * `file_name`), so a theme import that refers to `shopify://files/videos/intro.mp4`
 * reuses this copy instead of downloading it again.
 */
async function saveFileName(ctx: ImportContext, f: NFile, mediaId: string): Promise<void> {
  const name = nameKey(f)
  if (name) await ctx.inStore((tx) => saveMapping(tx, ctx.storeId, 'file_name', name, mediaId))
}

/**
 * A video's poster picture and phone-sized mp4, copied beside it and recorded by the
 * video's name (resources `file_poster`, `file_mobile`). Never fatal: the video plays
 * without them, and a retry fills them in.
 */
async function hostVideoExtras(ctx: ImportContext, f: NFile): Promise<void> {
  const name = nameKey(f)
  if (f.kind !== 'video' || !name) return
  const extras = [
    ['file_poster', f.posterUrl],
    ['file_mobile', f.mobileUrl],
  ] as const
  for (const [resource, src] of extras) {
    if (!src || src === f.url) continue
    try {
      const id = await ctx.media.host(src, f.alt)
      if (!id) throw new Error('the file could not be copied')
      await ctx.inStore((tx) => saveMapping(tx, ctx.storeId, resource, name, id))
    } catch (err) {
      ctx.report.issue({
        resource: 'files',
        ref: name,
        message: `${resource === 'file_poster' ? 'Poster picture' : 'Phone-sized copy'} not copied: ${errorMessage(err)}`,
      })
    }
  }
}

/** Our media id for a Shopify file, copying it once. Throws when the download fails. */
export async function hostShopifyFile(ctx: ImportContext, f: NFile): Promise<HostedFile> {
  const why = whyNotHostable(f)
  if (why) return why
  if (ctx.mediaOff) {
    return { ok: false, reason: 'storage_unwritable', message: 'File storage is not writable' }
  }
  const existing = await ctx.inStore((tx) => findMapping(tx, 'files', f.sourceId))
  if (existing) {
    const url = await ctx.media.urlOf(existing)
    if (url) {
      await saveFileName(ctx, f, existing)
      await hostVideoExtras(ctx, f)
      return { ok: true, mediaId: existing }
    }
  }
  const mediaId = await ctx.media.host(f.url as string, f.alt)
  if (!mediaId) throw new Error('the file could not be copied')
  await ctx.inStore((tx) => saveMapping(tx, ctx.storeId, 'files', f.sourceId, mediaId))
  await saveFileName(ctx, f, mediaId)
  await hostVideoExtras(ctx, f)
  return { ok: true, mediaId }
}

async function alreadyImported(ctx: ImportContext, f: NFile): Promise<boolean> {
  return ctx.inStore(async (tx) => {
    if (await findMapping(tx, 'files', f.sourceId)) return true
    return f.url ? Boolean(await findMapping(tx, 'media', mediaSourceKey(f.url))) : false
  })
}

/** What the Files step tracks across files: the tally for the estimate, and whether unused ones are skipped. */
export type FilesPlan = { tally: FilesTally; skipUnused: boolean }

export async function writeFile(
  ctx: ImportContext,
  f: NFile,
  plan?: FilesPlan,
): Promise<string | null> {
  const ref =
    f.alt ||
    (f.url ? mediaSourceKey(f.url).split('/').pop() : null) ||
    `File ${f.sourceId.split('/').pop()} (no name in Shopify)`
  const why = whyNotHostable(f)
  if (why) {
    ctx.report.count('files', 'skipped')
    ctx.report.leave('files', why.reason, 1, why.detail)
    ctx.report.issue({ resource: 'files', ref, message: why.message })
    return null
  }
  try {
    const existed = await alreadyImported(ctx, f)
    const unused = Boolean(plan?.skipUnused) && !existed && !ctx.fileUsage.has(f)
    plan?.tally.take(f, unused)
    if (unused) {
      ctx.report.count('files', 'skipped')
      ctx.report.leave('files', 'unused_file', 1, f.kind === 'video' ? 'video' : 'image')
      return null
    }
    if (ctx.dryRun) {
      ctx.report.count('files', existed ? 'updated' : 'created')
      ctx.report.sample({
        resource: 'files',
        key: f.sourceId,
        title: ref,
        action: existed ? 'update' : 'create',
        detail: f.kind === 'video' ? videoDetail(f) : fileKindName(f.mimeType),
      })
      return null
    }
    if (ctx.mediaOff) {
      // Storage failed its write test at the start of the run; one issue already says so.
      ctx.report.count('files', 'skipped')
      ctx.report.leave('files', 'storage_unwritable')
      return null
    }
    const hosted = await hostShopifyFile(ctx, f)
    if (!hosted.ok) {
      ctx.report.count('files', 'skipped')
      ctx.report.leave('files', hosted.reason, 1, hosted.detail)
      ctx.report.issue({ resource: 'files', ref, message: hosted.message })
      return null
    }
    ctx.report.count('files', existed ? 'updated' : 'created')
    return hosted.mediaId
  } catch (err) {
    ctx.report.count('files', 'failed')
    ctx.report.issue({
      resource: 'files',
      ref,
      sourceId: f.sourceId,
      kind: 'file',
      message: `Not copied: ${errorMessage(err)}`,
    })
    return null
  }
}
