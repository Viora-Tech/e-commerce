import { describe, expect, it } from 'vitest'
import {
  cycleScope,
  highlightParts,
  MAX_RECENTS,
  matchesWords,
  parseRecents,
  pushRecent,
  searchHref,
  settingsBreadcrumb,
} from './palette-search'

describe('cycleScope', () => {
  it('moves forward and back, wrapping at the ends', () => {
    expect(cycleScope('all', 1)).toBe('orders')
    expect(cycleScope('settings', 1)).toBe('all')
    expect(cycleScope('all', -1)).toBe('settings')
    expect(cycleScope('products', -1)).toBe('orders')
  })
})

describe('matchesWords', () => {
  it('needs every typed word somewhere, in any order and case', () => {
    expect(matchesWords(['Create product'], 'PRODUCT create')).toBe(true)
    expect(matchesWords(['Orders', 'Drafts'], 'drafts orders')).toBe(true)
    expect(matchesWords(['Orders'], 'orders returns')).toBe(false)
  })

  it('matches everything when nothing is typed', () => {
    expect(matchesWords(['anything'], '   ')).toBe(true)
  })
})

describe('highlightParts', () => {
  it('marks each typed word, case-insensitively', () => {
    expect(highlightParts('Ali Raza', 'ali')).toEqual([
      { text: 'Ali', match: true },
      { text: ' Raza', match: false },
    ])
    expect(highlightParts('Blue shirt, blue', 'BLUE')).toEqual([
      { text: 'Blue', match: true },
      { text: ' shirt, ', match: false },
      { text: 'blue', match: true },
    ])
  })

  it('ignores a leading # so an order number lights up', () => {
    expect(highlightParts('#1042', '#104')).toEqual([
      { text: '#', match: false },
      { text: '104', match: true },
      { text: '2', match: false },
    ])
  })

  it('returns the text whole when there is nothing to mark', () => {
    expect(highlightParts('Orders', '')).toEqual([{ text: 'Orders', match: false }])
    expect(highlightParts('Orders', 'zzz')).toEqual([{ text: 'Orders', match: false }])
  })
})

describe('links', () => {
  it('puts the query on the list page, encoded', () => {
    expect(searchHref('/orders', 'ali raza')).toBe('/orders?query=ali%20raza')
  })

  it('builds the settings trail under Settings', () => {
    expect(settingsBreadcrumb('Taxes & GST › GST & invoices', 'Settings', ' › ')).toBe(
      'Settings › Taxes & GST › GST & invoices',
    )
    expect(settingsBreadcrumb('Settings', 'Settings', ' › ')).toBe('Settings')
  })
})

describe('recents', () => {
  it('puts the newest first, drops the older copy and caps the list', () => {
    let list = pushRecent([], { label: 'A', href: '/a' })
    list = pushRecent(list, { label: 'B', href: '/b' })
    list = pushRecent(list, { label: 'A again', href: '/a' })
    expect(list.map((e) => e.href)).toEqual(['/a', '/b'])
    for (let i = 0; i < 10; i++) list = pushRecent(list, { label: `P${i}`, href: `/p${i}` })
    expect(list).toHaveLength(MAX_RECENTS)
    expect(list[0]?.href).toBe('/p9')
  })

  it('reads the saved list back and refuses anything malformed', () => {
    const saved = JSON.stringify([{ label: 'Orders', href: '/orders', hint: 'Go to' }])
    expect(parseRecents(saved)).toEqual([{ label: 'Orders', href: '/orders', hint: 'Go to' }])
    expect(parseRecents(null)).toEqual([])
    expect(parseRecents('not json')).toEqual([])
    expect(parseRecents('{"label":"x"}')).toEqual([])
    expect(parseRecents(JSON.stringify([{ label: 'x', href: 'https://evil.example' }]))).toEqual([])
    expect(parseRecents(JSON.stringify([{ label: 1, href: '/a' }, null]))).toEqual([])
  })
})
