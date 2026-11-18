/**
 * A video's smaller copy (`packages/core/src/media/compact-video.ts` decides which videos, where
 * the copy goes and how the storefront uses it). This file runs ffmpeg: the original is
 * re-encoded to H.264 at most 1080p, CRF 26 capped near 3.5 Mbps, AAC audio at 96 kbps (kept for
 * product videos with sound), `+faststart` so playback starts before the whole file arrives.
 * Waimers' 34 MB hero clip came out at about 9 MB with no visible loss (17 Nov 2026 test).
 *
 * Work happens on temp files, outside any database transaction (a long encode must not hold a
 * connection): read the row, download, encode, upload, then save the copy's address in a second
 * short transaction. The original is never changed or deleted, also when the job fails: a video
 * without a copy simply plays its original.
 *
 * ffmpeg (LGPL/GPL, used as a separate program, never linked) comes from Alpine in the worker
 * image; `FFMPEG_PATH` overrides where it is looked for. Two threads, so a 1080p encode stays
 * around 200 MB of memory beside the worker.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  compactVideoKey,
  isCompactableVideo,
  markVideoCompact,
  storageForStore,
  worthKeeping,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, media, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { eq } from 'drizzle-orm'

/** An encode taking longer than this is stopped (a broken file, a very long upload). */
const ENCODE_TIMEOUT_MS = 15 * 60_000

/** ffmpeg's arguments for the copy: `input` and `output` are file paths. */
export function ffmpegArgs(input: string, output: string): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    "scale='min(1920,iw)':-2",
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '26',
    '-maxrate',
    '3500k',
    '-bufsize',
    '7000k',
    '-rc-lookahead',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-movflags',
    '+faststart',
    '-threads',
    '2',
    output,
  ]
}

/** The smaller copy of `bytes`, or throws with ffmpeg's error text. */
export async function encodeCompactVideo(bytes: Uint8Array): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), 'video-'))
  const input = join(dir, 'in')
  const output = join(dir, 'out.mp4')
  try {
    await writeFile(input, bytes)
    const proc = Bun.spawn([process.env.FFMPEG_PATH || 'ffmpeg', ...ffmpegArgs(input, output)], {
      stdout: 'ignore',
      stderr: 'pipe',
    })
    const timer = setTimeout(() => proc.kill(), ENCODE_TIMEOUT_MS)
    const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
    clearTimeout(timer)
    if (code !== 0) throw new Error(`ffmpeg exited ${code}: ${stderr.trim().slice(0, 500)}`)
    return new Uint8Array(await readFile(output))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export type CompactResult = 'made' | 'skipped' | 'not-smaller'

/** Makes and saves the smaller copy of one video row; safe to run again (it overwrites). */
export async function compactVideo(
  db: Db,
  storeId: string,
  mediaId: string,
  settingsSecret: string,
): Promise<CompactResult> {
  const found = await withStore(db, storeId, async (tx) => {
    const [row] = await tx.select().from(media).where(eq(media.id, mediaId))
    if (!row?.key || !isCompactableVideo(row.contentType)) return null
    const { storage } = await registriesForStore(tx, storeId)
    const provider = await storageForStore(tx, storeId, storage, settingsSecret)
    if (row.provider && row.provider !== provider.id) return null // file lives in an older bucket
    return { row, provider }
  })
  if (!found) return 'skipped'
  const { row, provider } = found
  const key = row.key as string
  const original = await provider.get(key)
  if (!original) throw new Error(`object missing at ${key}`)
  const started = Date.now()
  const copy = await encodeCompactVideo(original)
  if (!worthKeeping(original.byteLength, copy.byteLength)) {
    logger.info('video copy not smaller enough, original kept', {
      storeId,
      mediaId,
      original: original.byteLength,
      copy: copy.byteLength,
    })
    return 'not-smaller'
  }
  const copyKey = compactVideoKey(key)
  await provider.put({ key: copyKey, body: copy, contentType: 'video/mp4' })
  await withStore(db, storeId, (tx) =>
    markVideoCompact(tx, mediaId, {
      url: provider.publicUrl(copyKey),
      key: copyKey,
      size: copy.byteLength,
    }),
  )
  logger.info('video copy made', {
    storeId,
    mediaId,
    original: original.byteLength,
    copy: copy.byteLength,
    ms: Date.now() - started,
  })
  return 'made'
}
