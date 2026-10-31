'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

type ThemeProviderProps = {
  /** The script CSP's nonce for this request (`proxy.ts`), for the no-flash script. */
  nonce: string | undefined
  children: ReactNode
}

/**
 * Light, dark or system mode (next-themes, class on <html>). Its no-flash script runs from the
 * server's HTML; when React renders the provider again in the browser, the same tag goes out as
 * inert JSON, so React 19 does not warn "Encountered a script tag while rendering".
 */
export default function ThemeProvider({ nonce, children }: ThemeProviderProps) {
  // Render logic
  const scriptType = typeof window === 'undefined' ? 'text/javascript' : 'application/json'

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      nonce={nonce}
      scriptProps={{ type: scriptType }}
    >
      {children}
    </NextThemesProvider>
  )
}
