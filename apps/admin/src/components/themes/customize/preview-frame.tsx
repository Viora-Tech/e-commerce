'use client'

import { type Theme, themeRootAttrs, themeToCss } from '@commerce/core/theme'
import { type ReactNode, useEffect } from 'react'

type PreviewFrameProps = {
  children: ReactNode
  document?: Document | undefined
  theme: Theme
  mode: 'light' | 'dark'
}

/**
 * Paints the theme being edited into Puck's preview iframe, as the storefront
 * preview bridge does: the same CSS and root attributes. It goes into the frame
 * only, since the theme's variable names overlap the admin's own tokens.
 */
export default function PreviewFrame({ children, document, theme, mode }: PreviewFrameProps) {
  // Hooks
  useEffect(() => {
    if (!document) return
    const style = document.createElement('style')
    style.textContent = themeToCss(theme)
    document.head.appendChild(style)
    const root = document.documentElement
    for (const [name, value] of Object.entries(themeRootAttrs(theme)))
      root.setAttribute(name, value)
    root.setAttribute('data-theme', mode)
    return () => style.remove()
  }, [document, theme, mode])

  // Render logic
  return <>{children}</>
}
