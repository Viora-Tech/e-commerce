import { describe, expect, it } from 'vitest'
import { NavigationSettingsSchema, parseNavigationSettings } from './settings'

describe('parseNavigationSettings', () => {
  it('reads a stored pointer', () => {
    expect(
      parseNavigationSettings({ main: 'main-menu', footer: ['footer-shop', 'footer-community'] }),
    ).toEqual({ main: 'main-menu', footer: ['footer-shop', 'footer-community'] })
  })

  it('treats a store that never set one as having no menus', () => {
    expect(parseNavigationSettings(null)).toEqual({ main: null, footer: [] })
    expect(parseNavigationSettings(undefined)).toEqual({ main: null, footer: [] })
    expect(parseNavigationSettings({})).toEqual({ main: null, footer: [] })
  })

  it('falls back to no menus when the stored value is nonsense', () => {
    expect(parseNavigationSettings('main-menu')).toEqual({ main: null, footer: [] })
    expect(parseNavigationSettings({ main: 42 })).toEqual({ main: null, footer: [] })
    expect(parseNavigationSettings({ footer: ['shop', ''] })).toEqual({ main: null, footer: [] })
  })

  it('caps the footer at what one row of columns can hold', () => {
    const footer = Array.from({ length: 9 }, (_, i) => `menu-${i}`)
    expect(NavigationSettingsSchema.safeParse({ footer }).success).toBe(false)
    expect(NavigationSettingsSchema.safeParse({ footer: footer.slice(0, 8) }).success).toBe(true)
  })

  it('hands back an object the caller owns, not the shared default', () => {
    const a = parseNavigationSettings(null)
    a.footer.push('shop')
    expect(parseNavigationSettings(null).footer).toEqual([])
  })
})
