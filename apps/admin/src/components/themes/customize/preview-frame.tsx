'use client'

import { EditorSelectionContext } from '@commerce/blocks/editor-selection'
import { themeRootAttrs, themeToCss } from '@commerce/core/theme'
import { useGetPuck } from '@puckeditor/core'
import { useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect } from 'react'
import {
  canvasMotionCss,
  installCanvasMotion,
  scrollToSection,
} from '@/lib/customize-canvas-motion'
import { CANVAS_DROP_CSS, installMediaDrop } from '@/lib/customize-media-drop'
import { useCustomizePuck } from '@/lib/customize-puck'
import { useLiquidHead, usePreviewMode, useThemePreview } from '@/lib/customize-theme-context'
import { CANVAS_ZOOM_VAR, useCanvasZoom } from '@/lib/customize-zoom'
import CanvasInsertLine from './canvas-insert-line'

type PreviewFrameProps = {
  children: ReactNode
  document?: Document | undefined
}

/**
 * The page itself in the theme's colours, as the storefront's globals.css paints it. Puck
 * mirrors the admin's stylesheets into the frame, and without this the admin's own body
 * background and text (dark in a dark admin) showed through sections with no background.
 */
const CANVAS_PAGE_CSS =
  ':root{background:var(--color-bg)}body{background:var(--color-bg);color:var(--color-ink);font-family:var(--font-body)}'

/**
 * Paints the theme being edited into Puck's preview iframe, as the storefront
 * preview bridge does: the same CSS and root attributes. The theme and mode
 * come from context (see `PreviewModeContext`) so this stays one stable override. It goes into the frame
 * only, since the theme's variable names overlap the admin's own tokens. Also
 * where the canvas gets its drag/drop/enter motion. Puck mirrors the admin's
 * stylesheets into the frame (so editor chrome there uses admin tokens), but the
 * theme's CSS and the page colours reach it only from here.
 */
export default function PreviewFrame({ children, document }: PreviewFrameProps) {
  // Hooks
  const theme = useThemePreview()
  const mode = usePreviewMode()
  const liquid = useLiquidHead()
  const reducedMotion = useReducedMotion()
  const { zoom } = useCanvasZoom()
  const getPuck = useGetPuck()
  // Popups and the cookie banner open in the canvas only while selected (EditorOverlay).
  const selectedId = useCustomizePuck((s) => {
    const id = s.selectedItem?.props?.id
    return typeof id === 'string' ? id : null
  })
  useEffect(() => {
    // An imported Shopify theme brings its own CSS (below); ours would fight it.
    if (!document || !theme || liquid) return
    const style = document.createElement('style')
    style.textContent = themeToCss(theme) + CANVAS_PAGE_CSS
    document.head.appendChild(style)
    const root = document.documentElement
    for (const [name, value] of Object.entries(themeRootAttrs(theme)))
      root.setAttribute(name, value)
    root.setAttribute('data-theme', mode)
    // Puck copies the admin's <html> attributes into the frame (after this runs), including
    // next-themes' inline `color-scheme`; the theme's own CSS decides that here.
    const dropAdminScheme = () => {
      if (root.style.colorScheme) root.style.removeProperty('color-scheme')
    }
    dropAdminScheme()
    const observer = new MutationObserver(dropAdminScheme)
    observer.observe(root, { attributes: true, attributeFilter: ['style'] })
    return () => {
      observer.disconnect()
      style.remove()
    }
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

  // The canvas zoom, for the editor chrome inside it that keeps its on-screen size
  // (`UNZOOMED`, vendor-puck.css outlines).
  // A stylesheet rather than an inline style: the storefront rewrites the root's `style`.
  useEffect(() => {
    if (!document) return
    const style = document.createElement('style')
    style.textContent = `:root { ${CANVAS_ZOOM_VAR}: ${zoom}; }`
    document.head.appendChild(style)
    return () => style.remove()
  }, [document, zoom])

  // Pictures dragged in from the Media panel land in the section under the pointer.
  useEffect(() => {
    if (!document) return
    const style = document.createElement('style')
    style.textContent = CANVAS_DROP_CSS
    document.head.appendChild(style)
    const uninstall = installMediaDrop(document, getPuck as never, (id) =>
      scrollToSection(id, reducedMotion === true),
    )
    return () => {
      style.remove()
      uninstall()
    }
  }, [document, getPuck, reducedMotion])

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
