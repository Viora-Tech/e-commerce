import 'server-only'
import { type Theme, type ThemeMode, themeColorVars } from '@commerce/core'
import type { Viewport } from 'next'

export const THEME_COOKIE = 'theme'
export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']

export function parseThemeMode(value: string | undefined | null, fallback: ThemeMode): ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value ?? '') ? (value as ThemeMode) : fallback
}

/**
 * The mode a request renders in: the visitor's cookie, else the store default. With dark
 * mode switched off the store is light whatever a stale cookie says.
 */
export function resolveThemeMode(
  cookie: string | undefined,
  darkMode: Theme['darkMode'],
): ThemeMode {
  return darkMode.enabled ? parseThemeMode(cookie, darkMode.default) : 'light'
}

/** What to stamp on <html>. "system" stamps nothing so prefers-color-scheme decides. */
export function htmlThemeAttr(mode: ThemeMode): 'light' | 'dark' | undefined {
  return mode === 'system' ? undefined : mode
}

/**
 * Browser chrome (mobile address bar, overscroll) in the page background, and the
 * colour-scheme hint the browser reads before any CSS arrives, so native controls and the
 * first paint already match the mode the server rendered.
 */
export function themeViewport(theme: Theme, mode: ThemeMode): Viewport {
  const light = themeColorVars(theme, 'light')['--color-bg']
  const dark = themeColorVars(theme, 'dark')['--color-bg']
  if (mode === 'system') {
    return {
      colorScheme: 'light dark',
      themeColor: [
        ...(light ? [{ media: '(prefers-color-scheme: light)', color: light }] : []),
        ...(dark ? [{ media: '(prefers-color-scheme: dark)', color: dark }] : []),
      ],
    }
  }
  const color = mode === 'dark' ? dark : light
  return { colorScheme: mode, ...(color ? { themeColor: color } : {}) }
}
