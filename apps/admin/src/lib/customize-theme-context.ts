import type { Theme } from '@commerce/core/theme'
import { createContext, useContext } from 'react'

/** The theme being edited, for anything outside Puck's own tree that needs to render storefront sections (e.g. the add-section hover preview). */
export const ThemePreviewContext = createContext<Theme | null>(null)

export function useThemePreview(): Theme | null {
  return useContext(ThemePreviewContext)
}

/**
 * Light or dark, for the canvas iframe. Read through context rather than
 * passed as a prop so Puck's `iframe` override can be one stable,
 * module-level component: a fresh override function on every editor render
 * made React remount the whole canvas (the flicker on the first edit).
 */
export const PreviewModeContext = createContext<'light' | 'dark'>('light')

export function usePreviewMode(): 'light' | 'dark' {
  return useContext(PreviewModeContext)
}
