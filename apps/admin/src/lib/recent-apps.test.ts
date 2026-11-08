import { describe, expect, it } from 'vitest'
import {
  appIdFromPath,
  orderSidebarApps,
  parseRecentApps,
  pushRecentApp,
  RECENT_APPS_MAX,
} from './recent-apps'

const apps = ['gst', 'reviews', 'whatsapp', 'seo', 'loyalty'].map((id) => ({ id }))
const ids = (list: { id: string }[]) => list.map((a) => a.id)

describe('orderSidebarApps', () => {
  it('falls back to the first three installed apps with no history', () => {
    expect(ids(orderSidebarApps(apps, [], null))).toEqual(['gst', 'reviews', 'whatsapp'])
  })

  it('lists the most recently opened apps first', () => {
    expect(ids(orderSidebarApps(apps, ['loyalty', 'seo', 'gst', 'reviews'], null))).toEqual([
      'loyalty',
      'seo',
      'gst',
    ])
  })

  it('always shows the app on screen, first', () => {
    expect(ids(orderSidebarApps(apps, ['loyalty', 'seo', 'gst'], 'whatsapp'))).toEqual([
      'whatsapp',
      'loyalty',
      'seo',
    ])
  })

  it('fills a short history from installed order, without repeats', () => {
    expect(ids(orderSidebarApps(apps, ['seo'], null))).toEqual(['seo', 'gst', 'reviews'])
  })

  it('skips ids that are no longer installed, including a stray current id', () => {
    expect(ids(orderSidebarApps(apps, ['gone', 'seo'], 'install'))).toEqual([
      'seo',
      'gst',
      'reviews',
    ])
  })

  it('returns every app when fewer are installed than the limit', () => {
    expect(ids(orderSidebarApps(apps.slice(0, 2), ['reviews'], null))).toEqual(['reviews', 'gst'])
    expect(orderSidebarApps([], ['gst'], 'gst')).toEqual([])
  })
})

describe('pushRecentApp', () => {
  it('moves the opened app to the front once, and caps the list', () => {
    expect(pushRecentApp(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
    const long = Array.from({ length: RECENT_APPS_MAX }, (_, i) => `app-${i}`)
    const next = pushRecentApp(long, 'new')
    expect(next).toHaveLength(RECENT_APPS_MAX)
    expect(next[0]).toBe('new')
  })
})

describe('parseRecentApps', () => {
  it('reads a saved list and ignores anything else', () => {
    expect(parseRecentApps('["gst",3,"seo"]')).toEqual(['gst', 'seo'])
    expect(parseRecentApps(null)).toEqual([])
    expect(parseRecentApps('not json')).toEqual([])
    expect(parseRecentApps('{"a":1}')).toEqual([])
  })
})

describe('appIdFromPath', () => {
  it('finds the app id under /apps', () => {
    expect(appIdFromPath('/apps/gst-invoices')).toBe('gst-invoices')
    expect(appIdFromPath('/apps/gst-invoices/invoices/12')).toBe('gst-invoices')
    expect(appIdFromPath('/apps/my%20app')).toBe('my app')
    expect(appIdFromPath('/apps')).toBeNull()
    expect(appIdFromPath('/orders')).toBeNull()
  })
})
