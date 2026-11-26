/**
 * A video's smaller copy (`packages/core/src/media/compact-video.ts` decides which videos, where
 * the copy goes and how the storefront uses it; `./video-ffmpeg.ts` runs ffmpeg). Run by the
 * video queue's worker (`./media-video.ts`), one at a time, and by `bun run media:videos`.
 *
 * Memory: the video is never held whole. The original streams from the bucket to a temp file,
 * ffmpeg encodes file to file, and the copy streams back from disk (`getStream` / `putStream`,
 * falling back to a whole read or write only for a provider without them). A video already small
 * (under `SMALL_VIDEO_BYTES` by its `head` size: nothing is downloaded) or already lean (low
 * bitrate, by ffprobe) gets no encode.
 *
 * Work happens outside any database transaction (a long encode must not hold a connection):
 * read the row, download, encode, upload, then save the result in a second short transaction.
 * The original is never changed or deleted: a video without a copy plays its original.
 *
 * The same job makes the video's first-frame poster (`./video-poster.ts`) when it has none, from
 * the same download (a small video is downloaded for that alone). A failed poster is logged and
 * never fails the copy; the storefront then simply has no poster to paint first.
 */
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import {
  compactPlan,
  compactVideoKey,
  copyShapeFor,
  isCompactableVideo,
  linkAutoPoster,
  markVideoCompact,
  MEDIA_MISSING_ERROR,
  markMediaMissing,
  markVideoNoCopy,
  storageForStore,
  videoPosterKey,
  worthKeeping,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, media, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import type { StorageProvider } from '@commerce/storage'
import { eq } from 'drizzle-orm'
import {
  type EncodeOptions,
  encodeVideoFile,
  probeVideo,
  silentAudio,
  type VideoFacts,
} from './video-ffmpeg'
import { makePosterFile, type PosterFile } from './video-poster'

/**
 * What one run did: `small`/`lean`/`not-smaller` keep the original (marked, never retried);
 * `poster` made only the first-frame poster (the copy was looked at before, or is not needed).
 * `missing`: the original is gone from the bucket; the row is marked (`markMediaMissing`) and no
 * sweep retries it.
 */
export type CompactResult =
  | 'made'
  | 'skipped'
  | 'small'
  | 'lean'
  | 'not-smaller'
  | 'poster'
  | 'missing'

/** The ffmpeg side, swappable in tests (no ffmpeg there). */
export type VideoTools = {
  probe: (input: string) => Promise<VideoFacts>
  encode: (input: string, output: string, opts: EncodeOptions) => Promise<void>
  /** Whether the sound track is silence (the copy then has none). Missing: sound is kept. */
  silent?: (input: string) => Promise<boolean>
  /** The first-frame poster of `input` at `output` (`frame` is a scratch PNG). */
  poster: (input: string, frame: string, output: string) => Promise<PosterFile>
}

const defaultTools: VideoTools = {
  probe: probeVideo,
  encode: encodeVideoFile,
  silent: silentAudio,
  poster: makePosterFile,
}

/** The object at `key` into the file at `path`, streamed when the provider can. False: missing. */
export async function downloadToFile(
  provider: StorageProvider,
  key: string,
  path: string,
): Promise<boolean> {
  if (provider.getStream) {
    const body = await provider.getStream(key)
    if (!body) return false
    await pipeline(Readable.fromWeb(body as unknown as NodeReadableStream), createWriteStream(path))
    return true
  }
  const bytes = await provider.get(key)
  if (!bytes) return false
  await writeFile(path, bytes)
  return true
}

/** The file at `path` into the bucket at `key`, streamed when the provider can. */
export async function uploadFromFile(
  provider: StorageProvider,
  key: string,
  path: string,
  contentType: string,
): Promise<void> {
  if (provider.putStream) {
    const body = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream<Uint8Array>
    await provider.putStream({ key, body, contentType })
    return
  }
  await provider.put({ key, body: new Uint8Array(await readFile(path)), contentType })
}

/**
 * Makes the video's first-frame poster from the downloaded `input` and links it (only while the
 * video has no poster). Never throws: a missing poster only means the video paints later.
 */
async function makePoster(
  db: Db,
  ctx: PosterContext,
  input: string,
  dir: string,
  tools: VideoTools,
): Promise<boolean> {
  const posterKey = videoPosterKey(ctx.key)
  const output = join(dir, 'poster.webp')
  try {
    const file = await tools.poster(input, join(dir, 'frame.png'), output)
    await uploadFromFile(ctx.provider, posterKey, output, 'image/webp')
    return await linkPoster(db, ctx, posterKey, file)
  } catch (err) {
    logger.warn('video poster not made', { storeId: ctx.storeId, mediaId: ctx.mediaId, error: err })
    return false
  }
}

type PosterContext = { storeId: string; mediaId: string; key: string; provider: StorageProvider }

/** Links the poster object at `posterKey` to the video (a picture row in Files). */
async function linkPoster(
  db: Db,
  ctx: PosterContext,
  posterKey: string,
  file: { size: number; width?: number | null; height?: number | null },
): Promise<boolean> {
  const url = ctx.provider.publicUrl(posterKey)
  const id = await withStore(db, ctx.storeId, (tx) =>
    linkAutoPoster(tx, ctx.storeId, ctx.mediaId, {
      url,
      key: posterKey,
      provider: ctx.provider.id,
      size: file.size,
      width: file.width ?? null,
      height: file.height ?? null,
    }),
  )
  if (id) logger.info('video poster made', { storeId: ctx.storeId, mediaId: ctx.mediaId, url })
  return id !== null
}

/**
 * Makes and saves the smaller copy of one video row, and its first-frame poster when it has
 * none. A row already looked at for a copy (`compact_size` set) gets no copy unless `force`; a
 * re-run overwrites the copy at the same key. The poster is made whenever the video has no
 * poster (`poster_media_id` null), force or not, and never replaces one; a poster object
 * already in the bucket (an earlier run that stopped before linking it) is linked, not remade.
 */
export async function compactVideo(
  db: Db,
  storeId: string,
  mediaId: string,
  settingsSecret: string,
  opts: { force?: boolean; tools?: VideoTools } = {},
): Promise<CompactResult> {
  const tools = opts.tools ?? defaultTools
  const found = await withStore(db, storeId, async (tx) => {
    const [row] = await tx.select().from(media).where(eq(media.id, mediaId))
    if (!row?.key || !isCompactableVideo(row.contentType)) return null
    // Marked missing before: only a forced run looks again (the file may have been put back).
    if (row.processError === MEDIA_MISSING_ERROR && !opts.force) return null
    const needCopy = row.compactSize === null || Boolean(opts.force)
    const needPoster = !row.posterMediaId
    if (!needCopy && !needPoster) return null
    const { storage } = await registriesForStore(tx, storeId)
    const provider = await storageForStore(tx, storeId, storage, settingsSecret)
    if (row.provider && row.provider !== provider.id) return null // file lives in an older bucket
    const wasMissing = row.processError === MEDIA_MISSING_ERROR
    return { key: row.key, provider, needCopy, needPoster, wasMissing }
  })
  if (!found) return 'skipped'
  const { key, provider } = found
  const ctx: PosterContext = { storeId, mediaId, key, provider }
  const keep = async (result: CompactResult, facts: Record<string, unknown>) => {
    await withStore(db, storeId, (tx) => markVideoNoCopy(tx, mediaId))
    logger.info('video keeps its original', { storeId, mediaId, result, ...facts })
    return result
  }
  // The object is gone: marked once, so no sweep tries it again every hour (26 Nov 2026).
  const missing = async (): Promise<CompactResult> => {
    await withStore(db, storeId, (tx) => markMediaMissing(tx, mediaId))
    logger.warn('video file missing from storage', { storeId, mediaId, key })
    return 'missing'
  }

  // Size first, from the bucket's metadata: a small video is never downloaded for its copy.
  const head = await provider.head(key)
  if (!head) return await missing()
  if (found.wasMissing) {
    // A forced run found it back: the file is no longer reported missing.
    await withStore(db, storeId, (tx) =>
      tx.update(media).set({ processError: null }).where(eq(media.id, mediaId)),
    )
  }
  let result: CompactResult = 'skipped'
  let needCopy = found.needCopy
  if (needCopy && compactPlan({ bytes: head.size }) === 'small') {
    result = await keep('small', { original: head.size })
    needCopy = false
  }
  let needPoster = found.needPoster
  if (needPoster) {
    const posterKey = videoPosterKey(key)
    const made = await provider.head(posterKey)
    if (made) {
      if ((await linkPoster(db, ctx, posterKey, { size: made.size })) && result === 'skipped') {
        result = 'poster'
      }
      needPoster = false
    }
  }
  if (!needCopy && !needPoster) return result

  const dir = await mkdtemp(join(tmpdir(), 'video-'))
  const input = join(dir, 'in')
  const output = join(dir, 'out.mp4')
  try {
    if (!(await downloadToFile(provider, key, input))) return await missing()
    // The poster first: a frame is quick, and it is what the hero paints first.
    if (needPoster && (await makePoster(db, ctx, input, dir, tools)) && result === 'skipped') {
      result = 'poster'
    }
    if (!needCopy) return result

    const original = (await stat(input)).size
    const probe = await tools.probe(input)
    const plan = compactPlan({ bytes: original, ...probe })
    if (plan !== 'encode') return await keep(plan, { original, ...probe })

    // A portrait video is a phone's hero source: the phone settings. A silent track is dropped.
    const shape = copyShapeFor(probe)
    const audio = !(await tools.silent?.(input))
    const started = Date.now()
    await tools.encode(input, output, { shape, audio })
    const copy = (await stat(output)).size
    if (!worthKeeping(original, copy)) return await keep('not-smaller', { original, copy })

    const copyKey = compactVideoKey(key)
    await uploadFromFile(provider, copyKey, output, 'video/mp4')
    await withStore(db, storeId, (tx) =>
      markVideoCompact(tx, mediaId, { url: provider.publicUrl(copyKey), key: copyKey, size: copy }),
    )
    logger.info('video copy made', {
      storeId,
      mediaId,
      original,
      copy,
      width: shape.maxWidth,
      audio,
      ms: Date.now() - started,
    })
    return 'made'
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
