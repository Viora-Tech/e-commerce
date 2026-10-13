/** SOURCE OF TRUTH: tests for the SEO report's rules (checks.ts) — WHAT: each check, the score, duplicates, ranking and rich text reading / WHY: the report, the score and Fix with AI share these rules */
import { describe, expect, it } from 'vitest'
import { type SeoItem, seoBodyText, seoReport } from './checks'

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

function product(overrides: Partial<SeoItem> = {}): SeoItem {
  return {
    resource: 'product',
    id: 'p1',
    title: 'Wireless gaming mouse, 26K DPI',
    handle: 'wireless-gaming-mouse',
    seoTitle: null,
    seoDescription: 'A light wireless gaming mouse with a 26K DPI sensor and 90 hours of battery.',
    bodyText: words(80),
    imageCount: 3,
    imagesWithoutAlt: 0,
    vendor: 'Waimers',
    hasBarcode: true,
    ...overrides,
  }
}

/** One item's issue kinds, through the public report (duplicates need two items, so none here). */
const kinds = (item: SeoItem) => seoReport([item]).issues.map((i) => i.kind)

describe('item checks', () => {
  it('passes a complete product', () => {
    expect(kinds(product())).toEqual([])
  })

  it('flags long titles, missing photos, missing alt text and thin text', () => {
    expect(kinds(product({ seoTitle: 'x'.repeat(70) }))).toContain('title_long')
    expect(kinds(product({ imageCount: 0 }))).toContain('image_missing')
    expect(kinds(product({ imagesWithoutAlt: 2 }))).toContain('alt_missing')
    expect(kinds(product({ bodyText: words(10) }))).toContain('content_thin')
  })

  it('judges description length only when the merchant wrote one', () => {
    expect(kinds(product({ seoDescription: 'Short.' }))).toContain('description_short')
    expect(kinds(product({ seoDescription: null }))).not.toContain('description_short')
    expect(kinds(product({ seoDescription: null, bodyText: '' }))).toContain('description_missing')
  })

  it('flags handles that are not short lowercase hyphenated words', () => {
    expect(kinds(product({ handle: 'Mouse_2024' }))).toContain('handle_bad')
  })

  it('checks Google Shopping data on products only', () => {
    expect(kinds(product({ vendor: '', hasBarcode: false }))).toEqual(
      expect.arrayContaining(['shopping_brand_missing', 'shopping_gtin_missing']),
    )
    const page: SeoItem = { ...product(), resource: 'page', vendor: null, hasBarcode: false }
    expect(kinds(page)).not.toContain('shopping_gtin_missing')
  })

  it('flags a product with no search keywords chosen, as low impact AI can fix', () => {
    const report = seoReport([product({ keywordCount: 0 })])
    expect(report.issues).toEqual([
      expect.objectContaining({ kind: 'keyword_missing', severity: 'low' }),
    ])
    expect(report.fixable.keywords).toEqual(['p1'])
    expect(kinds(product({ keywordCount: 3 }))).not.toContain('keyword_missing')
    expect(kinds(product())).not.toContain('keyword_missing')
  })
})

describe('seoReport', () => {
  it('scores a clean store 100', () => {
    expect(seoReport([product()]).score).toBe(100)
    expect(seoReport([]).score).toBe(100)
  })

  it('finds duplicate titles within one kind and lists what AI can fix', () => {
    const report = seoReport([
      product({ id: 'a', title: 'Mouse pad' }),
      product({ id: 'b', title: 'Mouse pad', imagesWithoutAlt: 1 }),
    ])
    const dupes = report.issues.filter((i) => i.kind === 'title_duplicate')
    expect(dupes.map((d) => d.id).sort()).toEqual(['a', 'b'])
    expect(report.fixable.seo.sort()).toEqual(['a', 'b'])
    expect(report.fixable.altText).toEqual(['b'])
    expect(report.score).toBeLessThan(100)
  })

  it('ranks high impact first', () => {
    const report = seoReport([product({ handle: 'Bad Handle', imageCount: 0 })])
    expect(report.issues[0]?.severity).toBe('high')
  })
})

describe('seoBodyText', () => {
  it('reads Lexical JSON and legacy strings', () => {
    const lexical = { root: { children: [{ children: [{ text: 'Hello' }, { text: 'world' }] }] } }
    expect(seoBodyText(lexical)).toBe('Hello world')
    expect(seoBodyText('plain text')).toBe('plain text')
    expect(seoBodyText(null)).toBe('')
  })
})
