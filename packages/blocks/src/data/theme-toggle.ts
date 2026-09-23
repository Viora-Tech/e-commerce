import type { ThemeMode } from '../types'

/** Every string the light / dark / device toggle shows. */
export const themeToggleContent = {
  label: { light: 'Light', dark: 'Dark', system: 'Device' } satisfies Record<ThemeMode, string>,
  /** Screen reader and tooltip text: the mode in use, then what a click does. */
  action: (current: string, next: string) => `Theme: ${current}. Switch to ${next}.`,
} as const

/** Click order. Device (system) sits between the two so one click from it is always a change. */
export const THEME_MODE_NEXT: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

export const THEME_COOKIE = 'theme'

/** A year: the preference outlives the session like Shopify's own theme cookie. */
export const THEME_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365
