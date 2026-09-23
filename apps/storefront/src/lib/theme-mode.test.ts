import { defaultTheme } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import { htmlThemeAttr, parseThemeMode, resolveThemeMode, themeViewport } from './theme-mode'

const on = { enabled: true, default: 'system', togglePosition: 'header' } as const

describe('theme mode', () => {
  it('accepts only known modes, else the store default', () => {
    expect(parseThemeMode('dark', 'system')).toBe('dark')
    expect(parseThemeMode('purple', 'system')).toBe('system')
    expect(parseThemeMode(undefined, 'light')).toBe('light')
  })

  it('renders light when the store has dark mode off, whatever the cookie says', () => {
    expect(resolveThemeMode('dark', on)).toBe('dark')
    expect(resolveThemeMode(undefined, { ...on, default: 'dark' })).toBe('dark')
    expect(resolveThemeMode('dark', { ...on, enabled: false })).toBe('light')
  })

  it('stamps light and dark on html, nothing for system', () => {
    expect(htmlThemeAttr('dark')).toBe('dark')
    expect(htmlThemeAttr('light')).toBe('light')
    expect(htmlThemeAttr('system')).toBeUndefined()
  })

  it('hints the browser chrome with the page background of each mode', () => {
    const system = themeViewport(defaultTheme, 'system')
    expect(system.colorScheme).toBe('light dark')
    expect(system.themeColor).toHaveLength(2)
    const dark = themeViewport(defaultTheme, 'dark')
    expect(dark.colorScheme).toBe('dark')
    expect(typeof dark.themeColor).toBe('string')
    expect(dark.themeColor).not.toBe(themeViewport(defaultTheme, 'light').themeColor)
  })
})
