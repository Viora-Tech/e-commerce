/** SOURCE OF TRUTH: Files usage and size estimate tests — WHAT: which Shopify file names products, collections, pages and articles use, and the stored-size estimate of pictures and videos / WHY: the default import copies only used files and the preview quotes a size; both must stay honest */
import { describe, expect, it } from 'vitest'
import { FilesTally, FileUsage } from '../src/file-usage'
import type { NArticle, NCollection, NFile, NProduct } from '../src/types'

const file = (over: Partial<NFile>): NFile => ({
  sourceId: 'gid://shopify/MediaImage/1',
  kind: 'image',
  url: 'https://cdn.shopify.com/s/files/1/0/files/aria.png?v=3',
  alt: null,
  mimeType: 'image/png',
  size: 1_000_000,
  status: 'READY',
  ...over,
})

const stored = (f: NFile) => {
  const t = new FilesTally()
  t.take(f, false)
  const e = t.estimate(false)
  return e.totalBytes
}

describe('FileUsage', () => {
  it('knows a file by its name across address forms and resized copies', () => {
    const usage = new FileUsage()
    usage.product({
      images: [
        { src: 'https://cdn.shopify.com/s/files/1/products/aria_600x.png', alt: null, position: 1 },
      ],
      bodyHtml: '<img src="https://cdn.shopify.com/s/files/1/files/in-body.jpg">',
    } as unknown as NProduct)
    usage.article({
      image: null,
      bodyHtml: '<video poster="//cdn.shopify.com/s/files/1/files/poster.jpg"></video>',
      summaryHtml: null,
    } as unknown as NArticle)
    usage.collection({
      image: { src: 'https://cdn.shopify.com/files/Key%20Board.png' },
      bodyHtml: null,
    } as unknown as NCollection)
    expect(usage.has(file({}))).toBe(true)
    expect(usage.has(file({ url: 'https://cdn.shopify.com/files/in-body.jpg?v=2' }))).toBe(true)
    expect(usage.has(file({ url: 'https://cdn.shopify.com/files/poster.jpg' }))).toBe(true)
    expect(usage.has(file({ url: '//cdn.shopify.com/files/key_board.png' }))).toBe(false)
    expect(usage.has(file({ url: 'https://cdn.shopify.com/files/never-used.jpg' }))).toBe(false)
  })
})

describe('size estimate after optimizing', () => {
  it('shrinks a huge picture to the 2560 master and adds AVIF and WebP at each width', () => {
    const bytes = stored(file({ size: 20_000_000, width: 6000, height: 4000 }))
    expect(bytes).toBeLessThan(20_000_000)
    expect(bytes).toBeGreaterThan(1_000_000)
  })

  it('a small picture costs its master plus little (only the widths it can reach)', () => {
    const bytes = stored(file({ size: 50_000, width: 500, height: 400 }))
    expect(bytes).toBeLessThan(110_000)
    expect(bytes).toBeGreaterThan(50_000)
  })

  it('a video is its main mp4 plus the phone copy and a poster', () => {
    expect(
      stored(
        file({
          kind: 'video',
          size: 17_000_000,
          mobileSize: 5_000_000,
          posterUrl: 'https://x/p.jpg',
        }),
      ),
    ).toBe(17_000_000 + 5_000_000 + 200 * 1024)
  })

  it('tallies by kind and keeps unused files out of the total', () => {
    const t = new FilesTally()
    t.take(file({ size: 100, width: 100, height: 100 }), false)
    t.take(file({ kind: 'video', size: 1000 }), false)
    t.take(file({ size: 100, width: 100, height: 100 }), true)
    const e = t.estimate(false)
    expect(e).toMatchObject({ images: { count: 1 }, videos: { count: 1 }, unused: { count: 1 } })
    expect(e.totalBytes).toBe(e.images.bytes + e.videos.bytes)
  })
})
