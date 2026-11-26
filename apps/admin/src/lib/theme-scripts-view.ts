/** SOURCE OF TRUTH: the "Interactive preview" switch's state — WHAT: whether the Customize canvas shows the imported theme's page with its own scripts running / WHY: the canvas (customize-layout) owns the state and the top bar draws the switch, so it never floats over the store page */
'use client'

import { createContext, useContext } from 'react'

export type ThemeScriptsView = { on: boolean; setOn: (on: boolean) => void }

/** Null when the theme has no scripts view (our own themes): the switch is not drawn. */
export const ThemeScriptsViewContext = createContext<ThemeScriptsView | null>(null)

export function useThemeScriptsView(): ThemeScriptsView | null {
  return useContext(ThemeScriptsViewContext)
}
