'use client'

import { type Theme, themeRootAttrs, themeToCss } from '@commerce/core/theme'
import { useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect } from 'react'
import { canvasMotionCss, installCanvasMotion } from '@/lib/customize-canvas-motion'

type PreviewFrameProps = {
  children: ReactNode
  document?: Document | undefined
  theme: Theme
  mode: 'light' | 'dark'
}

/**
 * Paints the theme being edited into Puck's preview iframe, as the storefront
 * preview bridge does: the same CSS and root attributes. It goes into the frame
 * only, since the theme's variable names overlap the admin's own tokens. Also
 * where the canvas gets its drag/drop/enter motion — vendor-puck.css and the
 * admin's own stylesheets never reach the iframe, so this is the only place
 * that can style what's inside it.
 */
export default function PreviewFrame({ children, document, theme, mode }: PreviewFrameProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
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

  useEffect(() => {
    if (!document) return
    const style = document.createElement('style')
    style.textContent = canvasMotionCss(reducedMotion === true)
    document.head.appendChild(style)
    const uninstall = installCanvasMotion(document, reducedMotion === true)
    return () => {
      style.remove()
      uninstall()
    }
  }, [document, reducedMotion])

  // Marks this document as the Customize preview, and only as "moved" once the
  // pointer genuinely moves inside it — a section mounting under a stationary
  // cursor (e.g. right after selecting it) can otherwise fire a real hover
  // that opens a nav dropdown nobody asked to open. `header-nav.tsx` reads
  // both attributes and only suppresses hover-intent while they say so; the
  // live storefront never sets `data-customize-preview`, so its hover menus
  // are unaffected.
  useEffect(() => {
    if (!document) return
    const root = document.documentElement
    root.setAttribute('data-customize-preview', 'true')
    const handlePointerMove = () => {
      root.setAttribute('data-pointer-moved', 'true')
      document.removeEventListener('pointermove', handlePointerMove)
    }
    document.addEventListener('pointermove', handlePointerMove)
    return () => {
      root.removeAttribute('data-customize-preview')
      root.removeAttribute('data-pointer-moved')
      document.removeEventListener('pointermove', handlePointerMove)
    }
  }, [document])

  // Render logic
  return <>{children}</>
}
