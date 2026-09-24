import type { Theme } from '@commerce/core/theme'
import { createContext, useContext } from 'react'

/** The theme being edited, for anything outside Puck's own tree that needs to render storefront sections (e.g. the add-section hover preview). */
export const ThemePreviewContext = createContext<Theme | null>(null)

export function useThemePreview(): Theme | null {
  return useContext(ThemePreviewContext)
}
