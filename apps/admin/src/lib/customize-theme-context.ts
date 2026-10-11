import type { Theme } from '@commerce/core/theme'
import { createContext, useContext } from 'react'
import type { ImportedTheme } from './imported-sections'

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

/** An imported Shopify theme's page head for the canvas (stylesheets, CSS variables, fonts). */
export type LiquidHead = {
  head: string
  beforeHeader: string
  fontsHref: string | null
  htmlAttrs: Record<string, string>
}

/**
 * Set while Customize edits an imported theme: the canvas paints the theme's own head
 * instead of our theme CSS. Context for the same reason as `PreviewModeContext`.
 */
export const LiquidHeadContext = createContext<LiquidHead | null>(null)

export function useLiquidHead(): LiquidHead | null {
  return useContext(LiquidHeadContext)
}

/**
 * Set while Customize edits an imported theme: its section schemas, so the Add panel can offer
 * the theme's own sections. `null` for our own themes.
 */
export const ImportedThemeContext = createContext<ImportedTheme | null>(null)

export function useImportedTheme(): ImportedTheme | null {
  return useContext(ImportedThemeContext)
}
