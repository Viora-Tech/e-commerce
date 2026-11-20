'use client'

import { useRef } from 'react'
import { themeEditorAppsContent } from '@/data/theme-editor-apps'
import { useCopy } from '@/hooks/use-copy'
import { useThemeScriptsFrame } from '@/lib/use-theme-scripts-frame'

type ThemeScriptsFrameProps = {
  /** The store page in design mode (`designModeUrl`). */
  src: string
  /** The storefront's origin: the only one messages go to and are taken from. */
  origin: string
}

/**
 * The "Theme scripts" canvas: the page on the store's own address in a frame, with the imported
 * theme's JavaScript running (sliders, tabs, accordions move), which it never may inside the admin.
 * The editor's sections, unsaved settings and selection go to it over postMessage; it re-renders
 * what changed and fires Shopify's editor events (`apps/storefront/src/lib/liquid-design-mode.ts`).
 * A click on a section there selects it here (`useThemeScriptsFrame`).
 */
export default function ThemeScriptsFrame({ src, origin }: ThemeScriptsFrameProps) {
  // Hooks
  const copy = useCopy(themeEditorAppsContent)
  const frame = useRef<HTMLIFrameElement>(null)
  useThemeScriptsFrame(frame, origin)

  // Render logic
  return (
    <iframe
      ref={frame}
      src={src}
      title={copy.scriptsFrame}
      className="absolute inset-0 size-full border-0 bg-card"
    />
  )
}
