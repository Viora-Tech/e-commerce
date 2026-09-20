import type { ThemeMode } from '@commerce/core'

export const THEME_COOKIE = 'theme'
export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']

export function parseThemeMode(value: string | undefined | null, fallback: ThemeMode): ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value ?? '') ? (value as ThemeMode) : fallback
}

/** What to stamp on <html>. "system" stamps nothing so prefers-color-scheme decides. */
export function htmlThemeAttr(mode: ThemeMode): 'light' | 'dark' | undefined {
  return mode === 'system' ? undefined : mode
}
