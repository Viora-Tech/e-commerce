import type { ProductCopy } from '@commerce/ai/client'
import { plainTextToRichText, richTextToPlainText } from '@commerce/richtext'
import { describe, expect, it } from 'vitest'
import { appendSpecs, descriptionFromCopy, newTags, patchFromCopy } from './ai-product-copy'

const copy: ProductCopy = {
  intro: 'A light mouse for long sessions.',
  highlights: ['58 g', 'USB-C'],
  closing: 'Upgrade your desk.',
  specsTitle: 'Key specs',
  specs: [{ label: 'Weight', value: '58 g' }],
  seoTitle: 'Glide Mouse',
  seoDescription: 'A light mouse.',
  tags: ['gaming', 'Mouse', 'usb-c'],
  altTexts: [],
}

const all = { description: true, specs: true, seoTitle: true, seoDescription: true, tags: true }

describe('descriptionFromCopy', () => {
  it('builds intro, bullets, closing and the specs list as editor rich text', () => {
    const value = descriptionFromCopy(copy, true)
    expect(value.root.children?.map((n) => n.type)).toEqual([
      'paragraph',
      'list',
      'paragraph',
      'heading',
      'list',
    ])
    const plain = richTextToPlainText(value)
    expect(plain).toContain('A light mouse for long sessions.')
    expect(plain).toContain('Weight: 58 g')
  })

  it('leaves the specs out when not wanted', () => {
    expect(descriptionFromCopy(copy, false).root.children).toHaveLength(3)
  })
})

describe('patchFromCopy', () => {
  it('applies only what was ticked and merges tags without duplicates', () => {
    const patch = patchFromCopy(
      copy,
      { ...all, description: false, specs: false, seoDescription: false },
      { description: null, tags: ['mouse'] },
    )
    expect(patch).toEqual({ seoTitle: 'Glide Mouse', tags: ['mouse', 'gaming', 'usb-c'] })
  })

  it('adds just the specs to the current description', () => {
    const current = plainTextToRichText('My own words.')
    const patch = patchFromCopy(
      copy,
      { description: false, specs: true, seoTitle: false, seoDescription: false, tags: false },
      { description: current, tags: [] },
    )
    expect(richTextToPlainText(patch.description ?? null)).toContain('My own words.')
    expect(richTextToPlainText(patch.description ?? null)).toContain('Weight: 58 g')
    expect(appendSpecs(null, { ...copy, specs: [] }).root.children).toEqual([])
  })

  it('is empty when nothing is ticked', () => {
    const none = {
      description: false,
      specs: false,
      seoTitle: false,
      seoDescription: false,
      tags: false,
    }
    expect(patchFromCopy(copy, none, { description: null, tags: [] })).toEqual({})
  })
})

describe('newTags', () => {
  it('ignores case and spaces', () => {
    expect(newTags(['Gaming '], ['gaming', 'rgb'])).toEqual(['rgb'])
  })
})
