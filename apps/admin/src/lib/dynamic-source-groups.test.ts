import type { SourceOption } from '@commerce/core/dynamic-sources'
import { describe, expect, it } from 'vitest'
import {
  groupSources,
  type SourceSection,
  sectionPaths,
  splitMatch,
  startsOpen,
} from './dynamic-source-groups'

const titles = { product: 'Product', collection: 'Collection', shop: 'Store' }
const labelOf = (o: SourceOption) => o.label ?? o.path.split('.').at(-1) ?? o.path

const meta = (
  type: string,
  def: string,
  handle: string,
  entry: string,
  key: string,
  label: string,
) =>
  ({
    path: `metaobjects.${type}.${handle}.${key}`,
    type: 'single_line_text',
    group: 'metaobject',
    label,
    entry,
    definition: def,
  }) as SourceOption

const catalog: SourceOption[] = [
  { path: 'product.title', type: 'single_line_text', group: 'product' },
  {
    path: 'product.metafields.custom.care',
    type: 'single_line_text',
    group: 'product_metafields',
    label: 'Care',
  },
  { path: 'shop.name', type: 'single_line_text', group: 'shop' },
  meta('accessory_size', 'Accessory size', 'l', 'L', 'label', 'Label'),
  meta('accessory_size', 'Accessory size', 'large', 'Large', 'label', 'Label'),
  meta('faq', 'FAQ', 'shipping', 'Shipping', 'question', 'Question'),
  meta('faq', 'FAQ', 'shipping', 'Shipping', 'answer', 'Answer'),
]

describe('groupSources', () => {
  it('makes one section per source type and one row per content entry', () => {
    const sections = groupSources(catalog, labelOf, titles)
    expect(sections.map((s) => s.title)).toEqual(['Product', 'Store', 'Accessory size', 'FAQ'])
    expect(sections[0]?.rows.map((r) => r.label)).toEqual(['title', 'Care'])
    expect(sections[2]?.entries.map((e) => e.name)).toEqual(['L', 'Large'])
    expect(sections[3]?.entries).toEqual([
      {
        key: 'shipping',
        name: 'Shipping',
        fields: [
          { path: 'metaobjects.faq.shipping.question', label: 'Question' },
          { path: 'metaobjects.faq.shipping.answer', label: 'Answer' },
        ],
      },
    ])
  })

  it('keeps the inserted paths unchanged and in catalog order', () => {
    const paths = groupSources(catalog, labelOf, titles).flatMap(sectionPaths)
    expect(paths).toEqual(catalog.map((o) => o.path))
  })

  it('filters by section title, entry name or field label', () => {
    expect(groupSources(catalog, labelOf, titles, 'accessory')[0]?.entries).toHaveLength(2)
    const large = groupSources(catalog, labelOf, titles, 'LARGE')
    expect(large.map((s) => s.title)).toEqual(['Accessory size'])
    expect(large[0]?.entries.map((e) => e.name)).toEqual(['Large'])
    const answer = groupSources(catalog, labelOf, titles, 'answer')
    expect(answer[0]?.entries[0]?.fields.map((f) => f.label)).toEqual(['Answer'])
    expect(groupSources(catalog, labelOf, titles, 'zzz')).toEqual([])
  })
})

describe('startsOpen', () => {
  const [product, , sizes, faq] = groupSources(catalog, labelOf, titles)
  it('opens fixed sections and the content type holding the current source', () => {
    expect(startsOpen(product as SourceSection, null, 4)).toBe(true)
    expect(startsOpen(sizes as SourceSection, null, 4)).toBe(false)
    expect(startsOpen(faq as SourceSection, 'metaobjects.faq.shipping.answer', 4)).toBe(true)
    expect(startsOpen(sizes as SourceSection, null, 1)).toBe(true)
  })
})

describe('splitMatch', () => {
  it('marks each case-insensitive match', () => {
    expect(splitMatch('Large label', 'la')).toEqual([
      { text: 'La', match: true },
      { text: 'rge ', match: false },
      { text: 'la', match: true },
      { text: 'bel', match: false },
    ])
    expect(splitMatch('Title', '')).toEqual([{ text: 'Title', match: false }])
  })
})
