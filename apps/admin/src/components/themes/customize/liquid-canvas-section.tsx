'use client'

import type { LiquidSectionPlacement } from '@commerce/core/theme-import'
import { useEffect, useState } from 'react'
import { renderLiquidCanvas } from '@/lib/liquid-canvas'

type LiquidCanvasSectionProps = {
  themeId: string
  section: LiquidSectionPlacement
}

/** How long settings must stay still before the canvas asks for a fresh render. */
const SETTLE_MS = 180

/**
 * One imported Shopify section on the Customize canvas: the theme's own Liquid,
 * rendered on the server with this store's data. Scripts never run here (the canvas
 * shares the admin's origin); the storefront runs them. Re-renders when its settings
 * change, after a short pause so typing does not send a request per key.
 */
export default function LiquidCanvasSection({ themeId, section }: LiquidCanvasSectionProps) {
  // Hooks
  const [html, setHtml] = useState<string | null>(null)
  const key = JSON.stringify(section)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      renderLiquidCanvas(themeId, JSON.parse(key) as LiquidSectionPlacement).then(
        (next) => active && setHtml(next),
        () => active && setHtml(''),
      )
    }, SETTLE_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [themeId, key])

  // Early returns
  if (html === null) return <div className="min-h-24" aria-busy="true" />

  // Render logic
  // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered Liquid of the merchant's own imported theme, scripts and inline handlers stripped by the API (`theme-import.service.ts`).
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
