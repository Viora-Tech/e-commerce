/** SOURCE OF TRUTH: upload-time image pipeline — WHAT cleans the master, strips GPS, makes AVIF/WebP variants and a ThumbHash / WHY the live server never resizes on request */
/**
 * Upload-time image pipeline: run once, in the worker, right after an upload
 * is confirmed (or a Shopify-import media row is written). The live server
 * never resizes on request — every width/format the loader can ask for is
 * generated here and stored back with the media row.
 *
 * Pure function of bytes in, variants out, so it can be unit-tested with
 * small fixture buffers instead of a running worker. `sharp` (Apache-2.0) and
 * `thumbhash` (MIT) are credited in THIRD_PARTY_NOTICES.md.
 */

import sharp from 'sharp'
import { rgbaToThumbHash, thumbHashToRGBA } from 'thumbhash'
import { MAX_MASTER_LONG_EDGE, VARIANT_WIDTHS, variantKey } from './constants'

export { MAX_MASTER_LONG_EDGE, VARIANT_WIDTHS }

/**
 * Decompression-bomb guard: sharp refuses to even decode an image whose
 * pixel count exceeds this, before any resize happens. 40 MP comfortably
 * covers the largest phone/DSLR photos a merchant would realistically
 * upload while rejecting the classic "1x1 PNG that decodes to gigabytes"
 * attack.
 */
export const LIMIT_INPUT_PIXELS = 40_000_000

/** Downsized ThumbHash source: decoding a 100x100 crop is fast and the hash only needs ~100px. */
const THUMBHASH_MAX_DIMENSION = 100

export class DecompressionBombError extends Error {
  constructor(message = 'image exceeds the decompression-bomb pixel limit') {
    super(message)
  }
}

export type VariantUrls = { avif: string; webp: string }
export type PipelineVariants = Record<string, VariantUrls>

export type ProcessedAsset = {
  /** Content type of the file to write at `key`. */
  contentType: string
  key: string
  body: Uint8Array
}

export type ProcessImageResult = {
  /** The cleaned master: auto-oriented, metadata-stripped, capped at `MAX_MASTER_LONG_EDGE`. Replaces the original at the same key. */
  master: ProcessedAsset
  /** AVIF + WebP files per generated width, to write at `variantKey(width, format)`-style keys the caller chooses. */
  variants: { width: number; avif: ProcessedAsset; webp: ProcessedAsset }[]
  width: number
  height: number
  /** Base64-encoded ThumbHash placeholder. */
  thumbhash: string
  /** True when the source was an animated GIF, kept as a single animated WebP master with no responsive variants (see module doc). */
  animated: boolean
}

export type ProcessImageInput = {
  bytes: Uint8Array
  contentType: string
  /** The object key the cleaned master replaces; variant keys are derived from it by the caller. */
  masterKey: string
  /** AVIF/WebP quality; defaults tuned for a small 2-vCPU box. */
  quality?: { avif?: number; webp?: number } | undefined
  /** Encoder effort/speed; lower is faster. Defaults tuned for a small 2-vCPU box. */
  effort?: { avif?: number; webp?: number } | undefined
  /** Override for tests: proves the bomb guard rejects with a small, valid image instead of needing a real 40MP fixture. */
  maxInputPixels?: number | undefined
}

export { variantKey }

/**
 * Animated GIF becomes a single animated WebP master (`gif→animated webp`
 * chosen over "keep as GIF": WebP's animated encoder produces materially
 * smaller files at the same visual quality, and every browser this project
 * supports decodes animated WebP natively). No responsive width variants are
 * generated for it — animation multiplies encode cost per frame, and a
 * 2-vCPU box processing five widths of an animated clip is not a good trade
 * for a feature (animated product media) merchants use rarely. The single
 * WebP master is still auto-oriented, stripped of metadata and served
 * through the same `<Picture>`/loader fallback path as a static image.
 */
async function processAnimatedGif(
  bytes: Uint8Array,
  masterKey: string,
  quality: number,
  limit: number,
): Promise<ProcessImageResult> {
  const img = sharp(bytes, { animated: true, limitInputPixels: limit })
  const meta = await img.metadata()
  if (!meta.width || !meta.height) throw new Error('could not read GIF dimensions')
  // No `.withMetadata()` call: sharp strips all metadata (EXIF, GPS, ICC) by
  // default unless asked to keep it, so this is the strip, not a no-op.
  const webpBuffer = await img.rotate().webp({ quality, effort: 4 }).toBuffer()
  const stillFrame = await sharp(bytes, { limitInputPixels: limit })
    .rotate()
    .resize({ width: Math.min(meta.width, THUMBHASH_MAX_DIMENSION), withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const hash = rgbaToThumbHash(stillFrame.info.width, stillFrame.info.height, stillFrame.data)
  const webpKey = masterKey.replace(/\.[a-z0-9]+$/i, '.webp')
  return {
    master: { contentType: 'image/webp', key: webpKey, body: webpBuffer },
    variants: [],
    width: meta.width,
    height: meta.height,
    thumbhash: Buffer.from(hash).toString('base64'),
    animated: true,
  }
}

/** What the pipeline decodes: the raster formats uploads accept (AVIF and HEIC read as `heif`). */
const RASTER_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'heif', 'avif'])

/**
 * The bytes must really be one of the accepted raster formats. A file announced as
 * `image/png` that is an SVG (script inside), a TIFF or a PDF is refused, not decoded.
 */
function assertRasterFormat(format: string | undefined): void {
  if (!format || !RASTER_FORMATS.has(format)) {
    throw new Error(`not a supported image format: ${format ?? 'unknown'}`)
  }
}

/**
 * The full pipeline for one still image: auto-orient from EXIF, strip all
 * metadata (this is what removes GPS — sharp strips EXIF/ICC/XMP by default
 * unless `.withMetadata()` is called, so simply never calling it is the
 * strip), reject decompression bombs before decode, cap the long edge, generate
 * every configured width that doesn't upscale, and hash a ThumbHash
 * placeholder from a small decode of the cleaned master.
 *
 * Idempotent: called again on the same bytes it produces the same widths
 * (module-scope `VARIANT_WIDTHS`) and a deterministic ThumbHash, so a
 * retried job (crash after upload, before the DB write) just re-does the
 * same work rather than corrupting state.
 */
export async function processImage(input: ProcessImageInput): Promise<ProcessImageResult> {
  const avifQuality = input.quality?.avif ?? 55
  const webpQuality = input.quality?.webp ?? 72
  const avifEffort = input.effort?.avif ?? 4 // 0-9; 4 balances CPU vs. size on a 2-vCPU box
  const webpEffort = input.effort?.webp ?? 4 // 0-6
  const limit = input.maxInputPixels ?? LIMIT_INPUT_PIXELS

  if (input.contentType.toLowerCase() === 'image/gif') {
    const probe = sharp(input.bytes, { limitInputPixels: false })
    const meta = await probe.metadata()
    if (meta.pages && meta.pages > 1) {
      return processAnimatedGif(input.bytes, input.masterKey, webpQuality, limit)
    }
  }

  // limitInputPixels throws synchronously from sharp() when the header alone
  // already declares more pixels than the limit, before any frame decodes.
  let img: ReturnType<typeof sharp>
  let format: string | undefined
  try {
    img = sharp(input.bytes, { limitInputPixels: limit, failOn: 'error' })
    format = (await img.metadata()).format
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/exceeds|limitInputPixels|too large/i.test(message)) {
      throw new DecompressionBombError(message)
    }
    throw err
  }
  assertRasterFormat(format)

  // `sharp().metadata()` always describes the *source* pixels, never a
  // preview of queued operations — so it reports the un-rotated 400x300 and
  // orientation 6 unchanged. The auto-oriented (upright) dimensions swap
  // width/height ourselves for the four EXIF tags that rotate 90/270°; the
  // actual pixel rotation still happens via `.rotate()` in the pipeline below.
  const rawMeta = await sharp(input.bytes, { limitInputPixels: limit }).metadata()
  const rawWidth = rawMeta.width ?? 0
  const rawHeight = rawMeta.height ?? 0
  if (!rawWidth || !rawHeight) throw new Error('could not read image dimensions')
  const rotatesQuarterTurn = new Set([5, 6, 7, 8]).has(rawMeta.orientation ?? 1)
  const srcWidth = rotatesQuarterTurn ? rawHeight : rawWidth
  const srcHeight = rotatesQuarterTurn ? rawWidth : rawHeight

  const longEdge = Math.max(srcWidth, srcHeight)
  const masterScale = longEdge > MAX_MASTER_LONG_EDGE ? MAX_MASTER_LONG_EDGE / longEdge : 1
  const masterWidth = Math.round(srcWidth * masterScale)
  const masterHeight = Math.round(srcHeight * masterScale)

  // No `.withMetadata()` call: sharp strips all metadata (EXIF, GPS, ICC) by
  // default unless asked to keep it, so leaving it out is the strip.
  const masterPipeline = sharp(input.bytes, { limitInputPixels: limit })
    .rotate() // auto-orient from EXIF; the orientation tag itself does not survive into the output either way
    .resize({ width: masterWidth, height: masterHeight, withoutEnlargement: true })

  const isJpeg = input.contentType.toLowerCase() === 'image/jpeg'
  const masterFormatted = isJpeg
    ? masterPipeline.jpeg({ quality: 90, mozjpeg: true })
    : masterPipeline.png({ compressionLevel: 9 })
  const masterBuffer = await masterFormatted.toBuffer()
  const masterContentType = isJpeg ? 'image/jpeg' : 'image/png'

  const widths = VARIANT_WIDTHS.filter((w) => w <= masterWidth)
  const variants = await Promise.all(
    widths.map(async (width) => {
      const height = Math.round((width / masterWidth) * masterHeight)
      const base = sharp(masterBuffer, { limitInputPixels: limit }).resize({
        width,
        height,
        withoutEnlargement: true,
      })
      const [avifBuffer, webpBuffer] = await Promise.all([
        base.clone().avif({ quality: avifQuality, effort: avifEffort }).toBuffer(),
        base.clone().webp({ quality: webpQuality, effort: webpEffort }).toBuffer(),
      ])
      return {
        width,
        avif: {
          contentType: 'image/avif',
          key: variantKey(input.masterKey, width, 'avif'),
          body: avifBuffer,
        },
        webp: {
          contentType: 'image/webp',
          key: variantKey(input.masterKey, width, 'webp'),
          body: webpBuffer,
        },
      }
    }),
  )

  const thumbSource = await sharp(masterBuffer, { limitInputPixels: limit })
    .resize({
      width: Math.min(masterWidth, THUMBHASH_MAX_DIMENSION),
      height: Math.min(masterHeight, THUMBHASH_MAX_DIMENSION),
      fit: 'inside',
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const hash = rgbaToThumbHash(thumbSource.info.width, thumbSource.info.height, thumbSource.data)

  return {
    master: { contentType: masterContentType, key: input.masterKey, body: masterBuffer },
    variants,
    width: masterWidth,
    height: masterHeight,
    thumbhash: Buffer.from(hash).toString('base64'),
    animated: false,
  }
}

/** Decode a stored base64 ThumbHash back to a tiny RGBA bitmap; used by the `<Picture>` placeholder. */
export function decodeThumbhash(base64: string): {
  width: number
  height: number
  rgba: Uint8Array
} {
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
  const { w, h, rgba } = thumbHashToRGBA(bytes)
  return { width: w, height: h, rgba }
}
