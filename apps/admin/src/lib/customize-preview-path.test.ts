import { describe, expect, it } from 'vitest'
import { previewUrl } from '@/components/themes/theme-types'
import { customizePreviewPath } from './customize-preview-path'

const product = { kind: 'product', product: { handle: 'glass-pad' } } as const

describe('customizePreviewPath', () => {
  it('opens the page of the template being edited', () => {
    expect(customizePreviewPath('home', '', null)).toBe('/')
    expect(customizePreviewPath('product', '', product)).toBe('/products/glass-pad')
    expect(customizePreviewPath('collection', '', { kind: 'collection', handle: 'mice' })).toBe(
      '/collections/mice',
    )
    expect(customizePreviewPath('page', '', { kind: 'page', handle: 'about' })).toBe('/pages/about')
    expect(customizePreviewPath('cart', '', null)).toBe('/cart')
    expect(customizePreviewPath('search', '', null)).toBe('/search')
    expect(customizePreviewPath('login', '', null)).toBe('/account/login')
  })

  it('names an alternate template so the store draws it', () => {
    expect(customizePreviewPath('product', 'preorder', product)).toBe(
      '/products/glass-pad?view=preorder',
    )
  })

  it('falls back to the home page when no product, collection or page is chosen', () => {
    expect(customizePreviewPath('product', '', null)).toBe('/')
    expect(customizePreviewPath('blog', '', null)).toBe('/')
  })

  it('joins the preview token onto a path that has a query', () => {
    expect(previewUrl('https://w.in', 't', '/products/a?view=x')).toBe(
      'https://w.in/products/a?view=x&theme-preview=t',
    )
    expect(previewUrl('https://w.in', 't')).toBe('https://w.in/?theme-preview=t')
  })
})
