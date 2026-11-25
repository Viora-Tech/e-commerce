/**
 * A video's first-frame poster file (`packages/core/src/media/compact-video.ts` decides its key,
 * size and where it is linked; `./video-compact.ts` runs it in the same job as the smaller copy).
 * ffmpeg grabs the first frame as a PNG (`./video-ffmpeg.ts`), sharp sizes it (1280 wide for a
 * landscape video, 750 for a portrait phone source) and encodes WebP, stepping the quality down
 * until it is under 60 KB, like Shopify's `preview_images/<id>.thumbnail.0000000000.jpg`.
 * Memory: one frame (at most a 4K PNG) in sharp at a time, file to file.
 */
import { stat, writeFile } from 'node:fs/promises'
import { POSTER_MAX_BYTES, POSTER_QUALITIES, posterWidthFor } from '@commerce/core'
import sharp, { type OutputInfo } from 'sharp'
import { firstFrameFile } from './video-ffmpeg'

export type PosterFile = { width: number; height: number; size: number }

/** WebP of the PNG frame at `frame` into `output`, sized and stepped down to fit the budget. */
export async function encodePoster(frame: string, output: string): Promise<PosterFile> {
  const meta = await sharp(frame).metadata()
  if (!meta.width || !meta.height) throw new Error('first frame has no size')
  const width = posterWidthFor(meta.width, meta.height)
  let made: { data: Buffer; info: OutputInfo } | null = null
  for (const quality of POSTER_QUALITIES) {
    made = await sharp(frame)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true })
    if (made.data.length <= POSTER_MAX_BYTES) break
  }
  if (!made) throw new Error('poster not encoded')
  await writeFile(output, made.data)
  return { width: made.info.width, height: made.info.height, size: (await stat(output)).size }
}

/** The poster of the video at `input`, written to `output` (a `frame` PNG is made on the way). */
export async function makePosterFile(
  input: string,
  frame: string,
  output: string,
): Promise<PosterFile> {
  await firstFrameFile(input, frame)
  return encodePoster(frame, output)
}
