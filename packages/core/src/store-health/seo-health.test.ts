/** SOURCE OF TRUTH: Store health › SEO tests — each count, the samples and the passed total */
import { describe, expect, it } from 'vitest'
import type { SeoItem } from '../seo/checks'
import {
  SEO_HEALTH_CHECK_IDS,
  SEO_HEALTH_SAMPLE,
  type SeoHealthCheckId,
  seoHealth,
} from './seo-health'

function item(overrides: Partial<SeoItem> = {}): SeoItem {
  return {
    resource: 'product',
    id: 'p1',
    title: 'Wireless gaming mouse, 26K DPI',
    handle: 'wireless-gaming-mouse',
    seoTitle: null,
    seoDescription: 'A light wireless gaming mouse with a 26K DPI sensor and 90 hours of battery.',
    bodyText: 'Light and quick.',
    imageCount: 2,
    imagesWithoutAlt: 0,
    ...overrides,
  }
}

const check = (items: SeoItem[], id: SeoHealthCheckId) => {
  const found = seoHealth(items).checks.find((c) => c.id === id)
  if (!found) throw new Error(`no ${id}`)
  return found
}

describe('seoHealth', () => {
  it('passes every check for a clean catalogue', () => {
    const report = seoHealth([item()], new Date('2026-11-22T00:00:00Z'))
    expect(report.passed).toBe(SEO_HEALTH_CHECK_IDS.length)
    expect(report.checked).toEqual({ product: 1, collection: 0, page: 0 })
    expect(report.checkedAt).toBe('2026-11-22T00:00:00.000Z')
  })

  it('counts a missing description only when there is no description text either', () => {
    const items = [
      item({ id: 'a', seoDescription: null, bodyText: '' }),
      item({ id: 'b', title: 'Keyboard with hot-swap switches', seoDescription: null }),
      item({
        id: 'c',
        resource: 'page',
        title: 'About our store',
        seoDescription: '  ',
        bodyText: '',
      }),
    ]
    const c = check(items, 'description_missing')
    expect(c.count).toBe(2)
    expect(c.items.map((i) => i.id).sort()).toEqual(['a', 'c'])
  })

  it('counts very short and missing titles', () => {
    const items = [
      item({ id: 'a', title: 'Mouse' }),
      item({ id: 'b', title: 'Mouse', seoTitle: 'Wireless gaming mouse for esports' }),
      item({ id: 'c', resource: 'collection', title: '' }),
    ]
    expect(check(items, 'title_short').count).toBe(2)
  })

  it('counts duplicate titles within one kind, each item once', () => {
    const items = [
      item({ id: 'a', handle: 'pad-a', title: 'Glass mouse pad, black' }),
      item({ id: 'b', handle: 'pad-b', title: 'Glass mouse pad, BLACK' }),
      item({ id: 'c', resource: 'collection', title: 'Glass mouse pad, black' }),
    ]
    const c = check(items, 'title_duplicate')
    expect(c.count).toBe(2)
    expect(c.items.every((i) => i.resource === 'product')).toBe(true)
  })

  it('counts products with photos lacking alt text and the photos themselves', () => {
    const items = [
      item({ id: 'a', imagesWithoutAlt: 3 }),
      item({ id: 'b', title: 'Keyboard with hot-swap switches', imagesWithoutAlt: 1 }),
      item({ id: 'c', title: 'Headset with a detachable mic', imageCount: 0 }),
    ]
    const c = check(items, 'alt_missing')
    expect(c.count).toBe(2)
    expect(c.images).toBe(4)
  })

  it('finds product handles left as -copy, not collections or look-alikes', () => {
    const items = [
      item({ id: 'a', handle: 'mouse-copy' }),
      item({ id: 'b', handle: 'mouse-copy-2' }),
      item({ id: 'c', handle: 'copy-holder' }),
      item({ id: 'd', handle: 'photocopy' }),
      item({ id: 'e', resource: 'collection', handle: 'sale-copy' }),
    ]
    const c = check(items, 'handle_copy')
    expect(c.items.map((i) => i.id).sort()).toEqual(['a', 'b'])
  })

  it('names the first few items by title and counts the rest', () => {
    const items = Array.from({ length: SEO_HEALTH_SAMPLE + 3 }, (_, n) =>
      item({
        id: `p${n}`,
        handle: `p${n}-copy`,
        title: `Product number ${String(n).padStart(2, '0')}`,
      }),
    )
    const c = check(items, 'handle_copy')
    expect(c.count).toBe(SEO_HEALTH_SAMPLE + 3)
    expect(c.items).toHaveLength(SEO_HEALTH_SAMPLE)
    expect(c.items[0]?.title).toBe('Product number 00')
  })
})
