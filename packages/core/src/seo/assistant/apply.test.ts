/** SOURCE OF TRUTH: tests for applying SEO assistant drafts (apply.ts) — WHAT: trimming to the length limits, the permission per resource, and the plan of writes / WHY: Apply must write exactly what the preview showed, within Google's limits, and only with the right permission */
import { describe, expect, it } from 'vitest'
import { permissions } from '../../permissions/statement'
import {
  applyPermissions,
  clampSeoDraft,
  fitChars,
  fitWords,
  SEO_ASSISTANT_LIMITS,
  seoApplyPlan,
  wordsIn,
} from './apply'

describe('fitChars', () => {
  it('keeps short text, squashing spaces', () => {
    expect(fitChars('  Glass   mousepad ', 60)).toBe('Glass mousepad')
  })
  it('cuts long text at a word edge, never over the limit', () => {
    const long = 'Wireless gaming mouse with a 26K DPI sensor, 90 hour battery and a light shell'
    const cut = fitChars(long, 60)
    expect(cut.length).toBeLessThanOrEqual(60)
    expect(long.startsWith(cut)).toBe(true)
    expect(cut.endsWith(',')).toBe(false)
    expect(long.charAt(cut.length)).toBe(' ')
  })
  it('hard cuts one very long word', () => {
    expect(fitChars('x'.repeat(80), 60)).toHaveLength(60)
  })
})

describe('fitWords', () => {
  it('keeps text under the limit as it is, line breaks too', () => {
    expect(fitWords('Q: Is it washable?\nA: Yes.', 150)).toBe('Q: Is it washable?\nA: Yes.')
  })
  it('caps words and ends on a sentence when it can', () => {
    const sentence = 'This mousepad has a smooth glass top and a grippy base. '
    const out = fitWords(sentence.repeat(20), SEO_ASSISTANT_LIMITS.snippetMaxWords)
    expect(wordsIn(out)).toBeLessThanOrEqual(150)
    expect(out.endsWith('.')).toBe(true)
  })
})

describe('applyPermissions', () => {
  it('asks for each editor permission once', () => {
    expect(applyPermissions(['product', 'collection'])).toEqual([permissions.PRODUCTS_WRITE])
    expect(applyPermissions(['page', 'product']).sort()).toEqual(
      [permissions.ONLINE_STORE_WRITE, permissions.PRODUCTS_WRITE].sort(),
    )
  })
})

describe('seoApplyPlan', () => {
  it('maps each resource to its own write, trimmed to the limits', () => {
    const plan = seoApplyPlan([
      { resource: 'product', id: 'p1', seoTitle: 'T'.repeat(70), seoDescription: 'D' },
      { resource: 'collection', id: 'c1', seoTitle: 'Mice', seoDescription: '  ' },
      { resource: 'page', id: 'g1', seoTitle: 'About', seoDescription: 'Who we are' },
    ])
    expect(plan.products).toEqual([
      { productId: 'p1', patch: { seoTitle: 'T'.repeat(60), seoDescription: 'D' } },
    ])
    expect(plan.collections).toEqual([
      { id: 'c1', write: { seoTitle: 'Mice', seoDescription: null } },
    ])
    expect(plan.pages).toEqual([
      { id: 'g1', input: { seoTitle: 'About', seoDescription: 'Who we are' } },
    ])
  })
  it('keeps the last change when an item is listed twice', () => {
    const plan = seoApplyPlan([
      { resource: 'product', id: 'p1', seoTitle: 'First', seoDescription: 'a' },
      { resource: 'product', id: 'p1', seoTitle: 'Second', seoDescription: 'b' },
    ])
    expect(plan.products).toHaveLength(1)
    expect(plan.products[0]?.patch.seoTitle).toBe('Second')
  })
  it('caps descriptions at 155', () => {
    const plan = seoApplyPlan([
      { resource: 'page', id: 'g', seoTitle: 'x', seoDescription: 'word '.repeat(60) },
    ])
    expect(plan.pages[0]?.input.seoDescription?.length).toBeLessThanOrEqual(155)
  })
})

describe('clampSeoDraft', () => {
  it('cuts every part to its limit and counts the snippet', () => {
    const d = clampSeoDraft({
      seoTitle: `"${'Glass mousepad '.repeat(8)}"`,
      seoDescription: 'Smooth glass top. '.repeat(20),
      snippet: 'Word. '.repeat(200),
    })
    expect(d.seoTitle.length).toBeLessThanOrEqual(SEO_ASSISTANT_LIMITS.titleMax)
    expect(d.seoTitle.startsWith('"')).toBe(false)
    expect(d.seoDescription.length).toBeLessThanOrEqual(SEO_ASSISTANT_LIMITS.descriptionMax)
    expect(d.snippetWords).toBeLessThanOrEqual(SEO_ASSISTANT_LIMITS.snippetMaxWords)
  })
})
