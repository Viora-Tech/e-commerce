/**
 * SOURCE OF TRUTH: which Shopify Files an import needs, and what they weigh — WHAT: the picture and video file names that products, collections, pages and articles use (read while the run goes through them), the "is this file used" test for the Files step, and the size estimate of what gets stored after optimizing / WHY: a store's Files library can hold thousands of pictures nothing uses; the default import copies only what is used and the preview says how much space that takes
 */
import { MAX_MASTER_LONG_EDGE, VARIANT_WIDTHS } from '@commerce/core'
import type { FilesEstimate } from './client'
import type { NArticle, NCollection, NFile, NPage, NProduct } from './types'

/** A file's name as one comparable key: the last part of its address, lowercase, no query. */
function fileKeyOf(src: string | null | undefined): string | null {
  if (!src) return null
  const last = src.split(/[?#]/)[0]?.split('/').pop() ?? ''
  let name = last
  try {
    name = decodeURIComponent(last)
  } catch {
    // keep the raw name
  }
  // Shopify's resized copies are `name_600x.jpg`; the file is `name.jpg`.
  return name.toLowerCase().replace(/_(?:\d+x\d*|x\d+)(?=\.\w+$)/, '') || null
}

const URL_IN_HTML = /(?:src|href|poster|data-src)=["']([^"']+)["']/gi

/** The file names used by the records read so far. */
export class FileUsage {
  private readonly keys = new Set<string>()

  private add(src: string | null | undefined) {
    const key = fileKeyOf(src)
    if (key) this.keys.add(key)
  }

  private html(html: string | null | undefined) {
    if (!html) return
    for (const m of html.matchAll(URL_IN_HTML)) this.add(m[1])
  }

  product(p: NProduct) {
    for (const image of p.images) this.add(image.src)
    this.html(p.bodyHtml)
  }

  collection(c: NCollection) {
    this.add(c.image?.src)
    this.html(c.bodyHtml)
  }

  page(p: NPage) {
    this.html(p.bodyHtml)
  }

  article(a: NArticle) {
    this.add(a.image?.src)
    this.html(a.bodyHtml)
    this.html(a.summaryHtml)
  }

  /** Whether something already read uses this file. */
  has(f: NFile): boolean {
    const key = fileKeyOf(f.url) ?? fileKeyOf(f.filename)
    return key !== null && this.keys.has(key)
  }
}

/** Lighter than the original: a poster picture Shopify makes for a video. */
const POSTER_BYTES = 200 * 1024
/** AVIF and WebP together cost about this share of the master's bytes at full width. */
const VARIANT_SHARE = 0.8

/**
 * What one picture takes after optimizing: the cleaned master (long edge capped) plus an
 * AVIF and a WebP at every width up to the master's. Bytes shrink with the area; with no
 * dimensions the original's size stands in for the master.
 */
function imageStoredBytes(f: NFile): number {
  const bytes = f.size ?? 0
  const long = Math.max(f.width ?? 0, f.height ?? 0)
  if (!f.width || !long) return Math.round(bytes * (1 + VARIANT_SHARE))
  const scale = Math.min(1, MAX_MASTER_LONG_EDGE / long)
  const master = bytes * scale * scale
  const masterWidth = f.width * scale
  const variants = VARIANT_WIDTHS.filter((w) => w <= masterWidth).reduce(
    (sum, w) => sum + master * (w / masterWidth) ** 2 * VARIANT_SHARE,
    0,
  )
  return Math.round(master + variants)
}

/** What one video takes: the main mp4, the phone copy when there is one, and the poster. */
function videoStoredBytes(f: NFile): number {
  return (f.size ?? 0) + (f.mobileSize ?? 0) + (f.posterUrl ? POSTER_BYTES : 0)
}

const bucket = () => ({ count: 0, bytes: 0 })

/** Counts and weights of the Files step, kept while it runs and shown on the preview. */
export class FilesTally {
  readonly images = bucket()
  readonly videos = bucket()
  readonly other = bucket()
  readonly unused = bucket()

  take(f: NFile, unused: boolean) {
    if (unused) {
      this.unused.count++
      this.unused.bytes += f.kind === 'video' ? videoStoredBytes(f) : imageStoredBytes(f)
    } else if (f.kind === 'video') {
      this.videos.count++
      this.videos.bytes += videoStoredBytes(f)
    } else if (f.kind === 'image') {
      this.images.count++
      this.images.bytes += imageStoredBytes(f)
    } else {
      this.other.count++
      this.other.bytes += f.size ?? 0
    }
  }

  estimate(includeUnused: boolean): FilesEstimate {
    return {
      images: this.images,
      videos: this.videos,
      other: this.other,
      unused: this.unused,
      includeUnused,
      totalBytes: this.images.bytes + this.videos.bytes + this.other.bytes,
    }
  }
}
