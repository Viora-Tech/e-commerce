/** SOURCE OF TRUTH: theme import pages tests — WHAT: which Shopify templates an import turns into ours / WHY: guards the import mapping */
/** Which Shopify templates an import turns into ours, and the resource a page's path names. Pure. */
import { describe, expect, it } from 'vitest'
import { importedPages } from './import'
import { resourceHandle } from './page-context'
import { isImportedTemplate } from './report'

describe('importedPages', () => {
  it('takes home, the groups and the resource templates with their alternates', () => {
    expect(
      importedPages([
        'index',
        'header-group',
        'product',
        'product.preorder',
        'collection',
        'page.about',
        'page.Bad Name',
        'blog',
        'blog.series',
        'article.notes',
        'cart',
        'list-collections',
        'customers/account',
      ]),
    ).toEqual([
      ['home', '', 'index'],
      ['header', '', 'header-group'],
      ['footer', '', 'footer-group'],
      ['article', 'notes', 'article.notes'],
      ['blog', '', 'blog'],
      ['blog', 'series', 'blog.series'],
      ['collection', '', 'collection'],
      ['page', 'about', 'page.about'],
      ['product', '', 'product'],
      ['product', 'preorder', 'product.preorder'],
    ])
  })
})

describe('isImportedTemplate', () => {
  it('counts alternates with their base template', () => {
    expect(isImportedTemplate('page.faq')).toBe(true)
    expect(isImportedTemplate('article.notes')).toBe(true)
    expect(isImportedTemplate('product')).toBe(true)
    expect(isImportedTemplate('list-collections')).toBe(false)
    expect(isImportedTemplate('cart')).toBe(false)
  })
})

describe('resourceHandle', () => {
  it('reads the handle of a product, collection or page path', () => {
    expect(resourceHandle('product', '/products/mouse')).toEqual({
      kind: 'product',
      handle: 'mouse',
    })
    expect(resourceHandle('collection', '/collections/mice?page=2')).toEqual({
      kind: 'collection',
      handle: 'mice',
    })
    expect(resourceHandle('page', '/pages/about%20us')).toEqual({
      kind: 'page',
      handle: 'about us',
    })
  })

  it('reads a blog, and an article with its blog', () => {
    expect(resourceHandle('blog.series', '/blogs/notes?page=2')).toEqual({
      kind: 'blog',
      handle: 'notes',
    })
    expect(resourceHandle('article', '/blogs/notes/first-post')).toEqual({
      kind: 'article',
      handle: 'first-post',
      blog: 'notes',
    })
    expect(resourceHandle('article', '/blogs/notes')).toBeNull()
  })

  it('has nothing for other pages or a broken path', () => {
    expect(resourceHandle('index', '/')).toBeNull()
    expect(resourceHandle('product', '/collections/mice')).toBeNull()
    expect(resourceHandle('page', '/pages/%E0%A4')).toBeNull()
  })
})
