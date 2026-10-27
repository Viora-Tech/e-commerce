'use client'

import { type ReactNode, useState } from 'react'
import {
  ImportedThemeContext,
  type LiquidBlockFocus,
  LiquidBlocksContext,
  type LiquidBlocksState,
} from '@/lib/customize-theme-context'
import type { ImportedTheme } from '@/lib/imported-sections'

type ImportedThemeProviderProps = {
  /** The open imported theme, `null` for our own themes. */
  info: ImportedTheme | null
  fields: LiquidBlocksState['fields']
  children: ReactNode
}

/**
 * What Customize's panels know about an imported Shopify theme: its schemas (the Add panel,
 * Layers' block types) and its editor fields plus the block the inspector shows on its own.
 */
export default function ImportedThemeProvider({
  info,
  fields,
  children,
}: ImportedThemeProviderProps) {
  // Hooks
  const [focus, setFocus] = useState<LiquidBlockFocus | null>(null)

  // Render logic
  return (
    <ImportedThemeContext.Provider value={info}>
      <LiquidBlocksContext.Provider value={{ fields, focus, setFocus }}>
        {children}
      </LiquidBlocksContext.Provider>
    </ImportedThemeContext.Provider>
  )
}
