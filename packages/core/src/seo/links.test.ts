/** SOURCE OF TRUTH: tests for the SEO link checks (links.ts) — WHAT: link extraction, path normalising, internal vs old-store vs other, which paths are checked, and link issues in text and menus / WHY: a wrong answer here flags good links or misses broken ones */
import { describe, expect, it } from 'vitest'
import { seoReport } from './checks'
import { linkTarget, normalizeStorePath, pathExists, seoBodyLinks } from './links'

const hosts = new Set(['waimers.in'])

describe('links', () => {
  it('finds link and autolink URLs in Lexical JSON', () => {
    const doc = {
      root: {
        children: [
          { type: 'paragraph', children: [{ type: 'link', url: '/products/a', children: [] }] },
          { type: 'autolink', url: 'https://x.com', children: [] },
        ],
      },
    }
    expect(seoBodyLinks(doc)).toEqual(['/products/a', 'https://x.com'])
  })

  it('normalises store paths', () => {
    expect(normalizeStorePath('/Products/Mouse/?variant=1#top')).toBe('/products/mouse')
    expect(normalizeStorePath('/collections/mice/products/pad')).toBe('/products/pad')
  })

  it('tells internal, old-store and other links apart', () => {
    expect(linkTarget('https://www.waimers.in/pages/faq', hosts)).toEqual({
      kind: 'internal',
      path: '/pages/faq',
    })
    expect(linkTarget('https://waimers.myshopify.com/products/a', hosts).kind).toBe('old_store')
    expect(linkTarget('https://google.com/products/a', hosts).kind).toBe('other')
    expect(linkTarget('mailto:hi@x.in', hosts).kind).toBe('other')
  })

  it('checks only product, collection and page paths', () => {
    const known = new Set(['/products/a'])
    expect(pathExists('/products/a', known)).toBe(true)
    expect(pathExists('/products/gone', known)).toBe(false)
    expect(pathExists('/collections/all', known)).toBe(true)
    expect(pathExists('/blogs/news', known)).toBe(true)
  })

  it('reports broken and old-store links in text and menus', () => {
    const report = seoReport(
      [
        {
          resource: 'page',
          id: 'p',
          title: 'About',
          handle: 'about',
          seoTitle: null,
          seoDescription: null,
          bodyText: 'x',
          links: ['/products/gone', 'https://old.myshopify.com/pages/x'],
        },
      ],
      {
        knownPaths: new Set(),
        storeHosts: hosts,
        menus: [{ menuId: 'm', menuTitle: 'Main', itemTitle: 'Sale', url: '/collections/sale' }],
      },
    )
    const kinds = report.issues.map((i) => `${i.resource}:${i.kind}`)
    expect(kinds).toEqual(
      expect.arrayContaining(['page:link_broken', 'page:link_old_store', 'menu:link_broken']),
    )
    expect(report.checked.menu).toBe(1)
  })
})
