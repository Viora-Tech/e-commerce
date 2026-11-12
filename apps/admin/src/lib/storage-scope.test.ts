// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import type { MediaItem } from '@/components/media/media-pick-types'
import { copiedBlock, copyBlock } from './customize-clipboard'
import { readRecentLinks, rememberLink } from './customize-link-targets'
import { readRecentMedia, rememberMedia } from './media-recent'
import { dropLegacyUnscopedKeys, scopedStorageKey } from './storage-scope'

const storeA = { storeId: 'store-a', userId: 'user-1' }
const storeB = { storeId: 'store-b', userId: 'user-1' }
const otherMember = { storeId: 'store-a', userId: 'user-2' }

const media = (id: string) => ({ id, url: `https://cdn.test/${id}.jpg` }) as MediaItem

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('scopedStorageKey', () => {
  it('keys by store and member, or by store only', () => {
    expect(scopedStorageKey('x', storeA)).toBe('x:store:store-a:user:user-1')
    expect(scopedStorageKey('x', storeA, { perUser: false })).toBe('x:store:store-a')
  })

  it('gives no key before a store is picked', () => {
    expect(scopedStorageKey('x', null)).toBeNull()
    expect(scopedStorageKey('x', { storeId: 'store-a', userId: '' })).toBeNull()
  })
})

describe('store-specific recents', () => {
  it('keeps recent media apart per store and per member', () => {
    rememberMedia(storeA, [media('a1')])
    expect(readRecentMedia(storeA).map((m) => m.id)).toEqual(['a1'])
    expect(readRecentMedia(storeB)).toEqual([])
    expect(readRecentMedia(otherMember)).toEqual([])
    expect(readRecentMedia(null)).toEqual([])
  })

  it('keeps recent links apart per store', () => {
    rememberLink(storeA, { href: '/products/a', title: 'A', kind: 'product' })
    expect(readRecentLinks(storeA)).toHaveLength(1)
    expect(readRecentLinks(storeB)).toEqual([])
  })

  it('never pastes a block copied in another store', () => {
    const block = { type: 'Hero', props: { id: 'hero-1' } } as Parameters<typeof copyBlock>[1]
    copyBlock(storeA, block)
    expect(copiedBlock(storeA)?.props.id).toBe('hero-1')
    expect(copiedBlock(storeB)).toBeNull()
  })
})

describe('dropLegacyUnscopedKeys', () => {
  it('removes the old unscoped keys and leaves scoped and global ones', () => {
    localStorage.setItem('media.pick.recent', '[]')
    localStorage.setItem('customize.link.recent', '[]')
    localStorage.setItem('shiprocket-connect-tested', 'true')
    localStorage.setItem('activity-seen:a@b.test', '2026-11-01')
    localStorage.setItem('admin-recent-apps:v1:store-a', '[]')
    sessionStorage.setItem('customize.clipboard', '{}')
    sessionStorage.setItem('admin-assistant:v1:store-a', '[]')
    localStorage.setItem('customize.panels.v1', '{}')
    rememberMedia(storeA, [media('a1')])

    dropLegacyUnscopedKeys()

    expect(localStorage.getItem('media.pick.recent')).toBeNull()
    expect(localStorage.getItem('customize.link.recent')).toBeNull()
    expect(localStorage.getItem('shiprocket-connect-tested')).toBeNull()
    expect(localStorage.getItem('activity-seen:a@b.test')).toBeNull()
    expect(localStorage.getItem('admin-recent-apps:v1:store-a')).toBeNull()
    expect(sessionStorage.getItem('customize.clipboard')).toBeNull()
    expect(sessionStorage.getItem('admin-assistant:v1:store-a')).toBeNull()
    expect(localStorage.getItem('customize.panels.v1')).toBe('{}')
    expect(readRecentMedia(storeA)).toHaveLength(1)
  })
})
