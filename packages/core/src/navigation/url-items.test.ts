/** Menu "Web address" items: script URLs never reach a storefront link. */
import type { NavigationItem } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { NavigationItemSchema } from './items'
import { itemPath, toNavLinks } from './resolve'

const url = (value: string): NavigationItem => ({ id: 'u1', title: 'Link', type: 'url', value })

describe('menu web address items', () => {
  it('keeps store paths, anchors, http(s), mailto and tel links', () => {
    for (const v of [
      '/pages/about',
      '#faq',
      'https://instagram.com/x',
      'mailto:a@b.in',
      'tel:+911234567890',
    ]) {
      expect(itemPath('url', v)).toBe(v)
      expect(NavigationItemSchema.safeParse(url(v)).success).toBe(true)
    }
  })

  it('refuses script and data URLs when a menu is saved', () => {
    for (const v of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'data:text/html,x',
      'vbscript:x',
    ]) {
      expect(NavigationItemSchema.safeParse(url(v)).success).toBe(false)
    }
  })

  it('drops a stored script URL instead of rendering it', () => {
    expect(itemPath('url', 'javascript:alert(1)')).toBeNull()
    expect(itemPath('url', 'java\tscript:alert(1)')).toBeNull()
    expect(toNavLinks([url('javascript:alert(1)'), url('/pages/a')]).map((l) => l.href)).toEqual([
      '/pages/a',
    ])
  })
})
