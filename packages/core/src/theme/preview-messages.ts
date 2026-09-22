/**
 * The postMessage protocol between the admin theme editor and the storefront
 * preview it frames. The storefront announces `ready` once it has verified its
 * preview token; the editor answers with `apply` every time the draft changes and
 * whenever a `ready` arrives (a navigation inside the frame reloads the page).
 */
export const THEME_PREVIEW_PARAM = 'theme-preview'

export type ThemePreviewReady = { type: 'theme-preview:ready' }

export type ThemePreviewApply = {
  type: 'theme-preview:apply'
  /** A draft theme; the storefront validates it against ThemeSchema before painting. */
  theme: unknown
  mode: 'light' | 'dark'
}

export type ThemePreviewMessage = ThemePreviewReady | ThemePreviewApply

export function isThemePreviewMessage(data: unknown): data is ThemePreviewMessage {
  if (typeof data !== 'object' || data === null) return false
  const type = (data as { type?: unknown }).type
  return type === 'theme-preview:ready' || type === 'theme-preview:apply'
}
