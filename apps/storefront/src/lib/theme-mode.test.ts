import { describe, expect, it } from 'vitest'
import { htmlThemeAttr, parseThemeMode } from './theme-mode'

describe('theme mode', () => {
  it('accepts only known modes, else the store default', () => {
    expect(parseThemeMode('dark', 'system')).toBe('dark')
    expect(parseThemeMode('purple', 'system')).toBe('system')
    expect(parseThemeMode(undefined, 'light')).toBe('light')
  })

  it('stamps light and dark on html, nothing for system', () => {
    expect(htmlThemeAttr('dark')).toBe('dark')
    expect(htmlThemeAttr('light')).toBe('light')
    expect(htmlThemeAttr('system')).toBeUndefined()
  })
})
