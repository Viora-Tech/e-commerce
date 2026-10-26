/**
 * Whether a picture shows nothing: one flat colour (a white page that never painted, a body a
 * theme hides until its script runs). The theme picture is checked with it before it is saved,
 * and a stored one when Customize opens, so a blank picture is retaken instead of kept.
 */

/** The picture is shrunk to this many pixels across before it is read; plenty to see content. */
const SAMPLE_WIDTH = 64

/**
 * A pixel this close to the picture's most common colour (summed RGB difference, 0–765) counts
 * as that colour, so webp noise and a faint gradient still read as flat.
 */
const SAME_COLOUR = 24

/** Blank when at least this share of the pixels is the one colour. */
const FLAT_SHARE = 0.995

/** One RGBA pixel as an opaque colour: transparency is drawn over white, as the card shows it. */
function rgbAt(data: ArrayLike<number>, i: number): [number, number, number] {
  const a = (data[i + 3] ?? 255) / 255
  const over = (c: number) => Math.round((data[i + c] ?? 0) * a + 255 * (1 - a))
  return [over(0), over(1), over(2)]
}

/** True when RGBA pixel data (as `ImageData.data`) is all, or nearly all, one colour. */
export function isBlankPixels(data: ArrayLike<number>): boolean {
  const count = Math.floor(data.length / 4)
  if (count === 0) return true
  // The most common colour, at a coarse 16-step grid so near-identical pixels share a bucket.
  const buckets = new Map<number, number>()
  let top = 0
  let topCount = 0
  for (let p = 0; p < count; p++) {
    const [r, g, b] = rgbAt(data, p * 4)
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const n = (buckets.get(key) ?? 0) + 1
    buckets.set(key, n)
    if (n > topCount) {
      top = p
      topCount = n
    }
  }
  const [r0, g0, b0] = rgbAt(data, top * 4)
  let same = 0
  for (let p = 0; p < count; p++) {
    const [r, g, b] = rgbAt(data, p * 4)
    if (Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0) <= SAME_COLOUR) same++
  }
  return same / count >= FLAT_SHARE
}

/** The picture's pixels at `SAMPLE_WIDTH` across, or null when the browser cannot read them. */
async function samplePixels(blob: Blob): Promise<Uint8ClampedArray | null> {
  const bitmap = await createImageBitmap(blob)
  const width = Math.min(SAMPLE_WIDTH, bitmap.width)
  const height = Math.max(1, Math.round((bitmap.height * width) / Math.max(1, bitmap.width)))
  const canvas =
    typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return ctx.getImageData(0, 0, width, height).data
}

/**
 * Whether the picture at `url` (a data URL or a CORS-readable address) is blank. Null when it
 * cannot be read (network, decoding), which callers treat as "don't know".
 */
export async function isBlankImage(url: string): Promise<boolean | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return null
    const pixels = await samplePixels(await response.blob())
    return pixels ? isBlankPixels(pixels) : null
  } catch {
    return null
  }
}
