'use client'

import type { ReactNode } from 'react'
import { EditingThemeIdContext, ThemePacksContext } from '@/lib/customize-theme-context'

type ThemePacksProviderProps = {
  /** The theme Customize edits ("My sections" are listed and saved for it). */
  themeId: string
  /** This theme's opt-in section packs, read on the server (`theme.packs`). */
  packs: string[]
  children: ReactNode
}

/**
 * Hands Customize the edited theme's id and section packs from the server page, so the editor
 * builds its config and the Add panel filters its library from one value (a pack's sections only
 * when it is on for this theme, "My sections" only those this theme can render).
 */
export default function ThemePacksProvider({ themeId, packs, children }: ThemePacksProviderProps) {
  // Render logic
  return (
    <EditingThemeIdContext.Provider value={themeId}>
      <ThemePacksContext.Provider value={packs}>{children}</ThemePacksContext.Provider>
    </EditingThemeIdContext.Provider>
  )
}
