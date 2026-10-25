/** SOURCE OF TRUTH: tests for the menu link targets added in CMS PR5 */
import type { NavigationItem } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { renameMenuTargets } from '../redirects/handle-change'
import { MenuItemsSchema, NAVIGATION_ITEM_TYPES, NavigationItemSchema } from './items'
import { itemHref, itemPath } from './resolve'

const item = (p: Partial<NavigationItem> & Pick<NavigationItem, 'type'>): NavigationItem => ({
  id: 'i1',
  title: 'Link',
  ...p,
})

describe('menu link targets', () => {
  it('resolves blogs, posts, policies, search and all collections', () => {
    expect(itemPath('blog', 'news')).toBe('/blogs/news')
    expect(itemPath('article', 'news/launch-day')).toBe('/blogs/news/launch-day')
    expect(itemPath('policy', 'refund-policy')).toBe('/policies/refund-policy')
    expect(itemPath('search', undefined)).toBe('/search')
    expect(itemPath('collections', undefined)).toBe('/collections')
    expect(itemPath('home', 'ignored')).toBe('/')
    expect(itemHref(item({ type: 'blog', value: ' news ' }))).toBe('/blogs/news')
    expect(itemPath('blog', '')).toBeNull()
  })

  it('offers every type the storefront can open, home first and custom URL last', () => {
    expect(NAVIGATION_ITEM_TYPES[0]).toBe('home')
    expect(NAVIGATION_ITEM_TYPES.at(-1)).toBe('url')
    for (const t of ['blog', 'article', 'policy', 'search', 'collections'] as const) {
      expect(NAVIGATION_ITEM_TYPES).toContain(t)
    }
  })

  it('needs no destination for home, search and all collections', () => {
    for (const type of ['home', 'search', 'collections'] as const) {
      expect(NavigationItemSchema.safeParse(item({ type })).success).toBe(true)
    }
    expect(NavigationItemSchema.safeParse(item({ type: 'blog' })).success).toBe(false)
  })

  it('checks a post is blog/post and a policy is one of the five', () => {
    const ok = (p: Partial<NavigationItem> & Pick<NavigationItem, 'type'>) =>
      NavigationItemSchema.safeParse(item(p)).success
    expect(ok({ type: 'article', value: 'news/launch' })).toBe(true)
    expect(ok({ type: 'article', value: 'launch' })).toBe(false)
    expect(ok({ type: 'article', value: 'news/a/b' })).toBe(false)
    expect(ok({ type: 'policy', value: 'privacy-policy' })).toBe(true)
    expect(ok({ type: 'policy', value: 'cookie-policy' })).toBe(false)
    const bad = NavigationItemSchema.safeParse(item({ type: 'policy', value: 'nope' }))
    expect(bad.error?.issues[0]?.message).toBe('Pick one of your policies')
  })

  it('still checks nested items', () => {
    const r = MenuItemsSchema.safeParse([
      item({ type: 'home', children: [item({ id: 'c', type: 'article', value: 'x' })] }),
    ])
    expect(r.success).toBe(false)
  })
})

describe('renameMenuTargets', () => {
  it('moves every item of that kind and handle, at any level, and nothing else', () => {
    const items: NavigationItem[] = [
      item({ id: 'a', type: 'product', value: 'old' }),
      item({
        id: 'b',
        type: 'home',
        children: [
          item({ id: 'c', type: 'product', value: 'old' }),
          item({ id: 'd', type: 'collection', value: 'old' }),
          item({ id: 'e', type: 'url', value: '/products/old' }),
        ],
      }),
    ]
    const r = renameMenuTargets(items, 'product', 'old', 'new')
    expect(r.changed).toBe(2)
    expect(r.items[0]?.value).toBe('new')
    expect(r.items[1]?.children?.map((c) => c.value)).toEqual(['new', 'old', '/products/old'])
    // The input is not changed in place.
    expect(items[0]?.value).toBe('old')
    expect(renameMenuTargets(items, 'page', 'old', 'new').changed).toBe(0)
  })
})
