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
 * The id of the theme Customize is editing, for what sits deep in Puck's overrides and talks to
 * the server about this theme ("My sections": saved per theme when they hold Liquid). Empty
 * outside the editor.
 */
export const EditingThemeIdContext = createContext<string>('')

export function useEditingThemeId(): string {
  return useContext(EditingThemeIdContext)
}

/**
 * This theme's opt-in section packs (`theme.packs`), so the Add panel offers a pack's sections
 * (Zero Drift…) only where it is on. Context because the panel sits deep in Puck's overrides.
 */
export const ThemePacksContext = createContext<readonly string[]>([])

export function useThemePacks(): readonly string[] {
  return useContext(ThemePacksContext)
}

/**
 * Set while Customize edits an imported theme: its section schemas, so the Add panel can offer
 * the theme's own sections. `null` for our own themes.
 */
export const ImportedThemeContext = createContext<ImportedTheme | null>(null)

export function useImportedTheme(): ImportedTheme | null {
  return useContext(ImportedThemeContext)
}

/** The imported section's block the inspector shows on its own (a click on its Layers row). */
export type LiquidBlockFocus = { sectionId: string; blockId: string }

/**
 * An imported theme's editor fields by section type (`useLiquidTheme`), and which block of which
 * section the inspector shows: picking a block in Layers opens its settings alone, Shopify-style,
 * with a way back to its section. Empty for our own themes.
 */
export type LiquidBlocksState = {
  fields: Record<string, Record<string, unknown>> | null
  focus: LiquidBlockFocus | null
  setFocus: (focus: LiquidBlockFocus | null) => void
}

export const LiquidBlocksContext = createContext<LiquidBlocksState>({
  fields: null,
  focus: null,
  setFocus: () => {},
})

export function useLiquidBlocks(): LiquidBlocksState {
  return useContext(LiquidBlocksContext)
}
