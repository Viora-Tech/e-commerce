'use client'

import { EditorSelectionContext } from '@commerce/blocks/editor-selection'
import { themeRootAttrs, themeToCss } from '@commerce/core/theme'
import { useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect } from 'react'
import { canvasMotionCss, installCanvasMotion } from '@/lib/customize-canvas-motion'
import { useCustomizePuck } from '@/lib/customize-puck'
import { useLiquidHead, usePreviewMode, useThemePreview } from '@/lib/customize-theme-context'
import CanvasInsertLine from './canvas-insert-line'

type PreviewFrameProps = {
  children: ReactNode
  document?: Document | undefined
}

/**
 * Paints the theme being edited into Puck's preview iframe, as the storefront
 * preview bridge does: the same CSS and root attributes. The theme and mode
 * come from context (see `PreviewModeContext`) so this stays one stable override. It goes into the frame
 * only, since the theme's variable names overlap the admin's own tokens. Also
 * where the canvas gets its drag/drop/enter motion — vendor-puck.css and the
 * admin's own stylesheets never reach the iframe, so this is the only place
 * that can style what's inside it.
 */
export default function PreviewFrame({ children, document }: PreviewFrameProps) {
  // Hooks
  const theme = useThemePreview()
  const mode = usePreviewMode()
  const liquid = useLiquidHead()
  const reducedMotion = useReducedMotion()
  // Popups and the cookie banner open in the canvas only while selected (EditorOverlay).
  const selectedId = useCustomizePuck((s) => {
    const id = s.selectedItem?.props?.id
    return typeof id === 'string' ? id : null
  })
  useEffect(() => {
    // An imported Shopify theme brings its own CSS (below); ours would fight it.
    if (!document || !theme || liquid) return
    const style = document.createElement('style')
    style.textContent = themeToCss(theme)
    document.head.appendChild(style)
    const root = document.documentElement
    for (const [name, value] of Object.entries(themeRootAttrs(theme)))
      root.setAttribute(name, value)
    root.setAttribute('data-theme', mode)
    return () => style.remove()
  }, [document, theme, mode, liquid])

  // An imported Shopify theme: its stylesheets, CSS variables and fonts in the frame's
  // head, its icon sprite at the top of the body, its <html> attributes on the root.
  useEffect(() => {
    if (!document || !liquid) return
    const holder = document.createElement('template')
    const fonts = liquid.fontsHref ? `<link rel="stylesheet" href="${liquid.fontsHref}">` : ''
    holder.innerHTML = `${fonts}${liquid.head}`
    const added = Array.from(holder.content.childNodes)
    for (const node of added) document.head.appendChild(node)
    const sprite = document.createElement('div')
    sprite.style.display = 'contents'
    sprite.innerHTML = liquid.beforeHeader
    document.body.prepend(sprite)
    const root = document.documentElement
    const attrs = Object.entries(liquid.htmlAttrs).filter(([k]) => !k.startsWith('on'))
    for (const [name, value] of attrs) root.setAttribute(name, value)
    return () => {
      for (const node of added) node.parentNode?.removeChild(node)
      sprite.remove()
      for (const [name] of attrs) root.removeAttribute(name)
    }
  }, [document, liquid])

  // The storefront theme above redefines --primary/--primary-soft inside this
  // iframe, so canvas chrome that wants the admin's own accent (the canvas
  // dock, the selection overlay, canvas-motion's insert ring) can't just read
  // those names in here. Copy the admin document's *computed* values onto the
  // iframe root under different names once, so that chrome keeps working
  // regardless of which storefront theme is being edited.
  useEffect(() => {
    if (!document) return
    const admin = getComputedStyle(window.document.documentElement)
    const accent = admin.getPropertyValue('--primary').trim()
    const accentSoft = admin.getPropertyValue('--primary-soft').trim()
    const root = document.documentElement
    if (accent) root.style.setProperty('--admin-accent', accent)
    if (accentSoft) root.style.setProperty('--admin-accent-soft', accentSoft)
    return () => {
      root.style.removeProperty('--admin-accent')
      root.style.removeProperty('--admin-accent-soft')
    }
  }, [document])

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
  return (
    <EditorSelectionContext.Provider value={selectedId}>
      {children}
      {document ? <CanvasInsertLine document={document} /> : null}
    </EditorSelectionContext.Provider>
  )
}
