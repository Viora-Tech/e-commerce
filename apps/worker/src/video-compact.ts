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
  isCompactableVideo,
  markVideoCompact,
  markVideoNoCopy,
  storageForStore,
  worthKeeping,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, media, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import type { StorageProvider } from '@commerce/storage'
import { eq } from 'drizzle-orm'
import { encodeVideoFile, probeVideo } from './video-ffmpeg'

/** What one run did: `small`/`lean`/`not-smaller` keep the original (marked, never retried). */
export type CompactResult = 'made' | 'skipped' | 'small' | 'lean' | 'not-smaller'

/** The ffmpeg side, swappable in tests (no ffmpeg there). */
export type VideoTools = {
  probe: (input: string) => Promise<{ width: number | null; durationSec: number | null }>
  encode: (input: string, output: string) => Promise<void>
}

const defaultTools: VideoTools = { probe: probeVideo, encode: encodeVideoFile }

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
 * Makes and saves the smaller copy of one video row. A row already looked at (`compact_size`
 * set) is skipped unless `force`; a re-run overwrites the copy at the same key.
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
    if (row.compactSize !== null && !opts.force) return null
    const { storage } = await registriesForStore(tx, storeId)
    const provider = await storageForStore(tx, storeId, storage, settingsSecret)
    if (row.provider && row.provider !== provider.id) return null // file lives in an older bucket
    return { key: row.key, provider }
  })
  if (!found) return 'skipped'
  const { key, provider } = found
  const keep = async (result: CompactResult, facts: Record<string, unknown>) => {
    await withStore(db, storeId, (tx) => markVideoNoCopy(tx, mediaId))
    logger.info('video keeps its original', { storeId, mediaId, result, ...facts })
    return result
  }

  // Size first, from the bucket's metadata: a small video is never downloaded.
  const head = await provider.head(key)
  if (!head) throw new Error(`object missing at ${key}`)
  if (compactPlan({ bytes: head.size }) === 'small') return keep('small', { original: head.size })

  const dir = await mkdtemp(join(tmpdir(), 'video-'))
  const input = join(dir, 'in')
  const output = join(dir, 'out.mp4')
  try {
    if (!(await downloadToFile(provider, key, input))) throw new Error(`object missing at ${key}`)
    const original = (await stat(input)).size
    const probe = await tools.probe(input)
    const plan = compactPlan({ bytes: original, ...probe })
    if (plan !== 'encode') return await keep(plan, { original, ...probe })

    const started = Date.now()
    await tools.encode(input, output)
    const copy = (await stat(output)).size
    if (!worthKeeping(original, copy)) return await keep('not-smaller', { original, copy })

    const copyKey = compactVideoKey(key)
    await uploadFromFile(provider, copyKey, output, 'video/mp4')
    await withStore(db, storeId, (tx) =>
      markVideoCompact(tx, mediaId, { url: provider.publicUrl(copyKey), key: copyKey, size: copy }),
    )
    logger.info('video copy made', { storeId, mediaId, original, copy, ms: Date.now() - started })
    return 'made'
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
