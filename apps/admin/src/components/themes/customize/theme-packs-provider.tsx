'use client'

import type { ReactNode } from 'react'
import { ThemePacksContext } from '@/lib/customize-theme-context'

type ThemePacksProviderProps = {
  /** The store's opt-in theme packs, read on the server (`themes.packs`). */
  packs: string[]
  children: ReactNode
}

/**
 * Hands Customize the store's theme packs from the server page, so the editor builds its config
 * and the Add panel filters its library from one value (a pack's sections only when it is on).
 */
export default function ThemePacksProvider({ packs, children }: ThemePacksProviderProps) {
  // Render logic
  return <ThemePacksContext.Provider value={packs}>{children}</ThemePacksContext.Provider>
}
