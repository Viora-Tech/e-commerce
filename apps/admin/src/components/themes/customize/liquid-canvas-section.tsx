'use client'

import type { LiquidSectionPlacement } from '@commerce/core/theme-import'
import { useEffect, useRef, useState } from 'react'
import { useLiquidThemeSettings } from '@/lib/customize-theme-context'
import { renderLiquidCanvas } from '@/lib/liquid-canvas'
import CanvasAppBlocks from './canvas-app-blocks'

type LiquidCanvasSectionProps = {
  themeId: string
  section: LiquidSectionPlacement
}

/**
 * The section and the unsaved Theme settings as a string, so the render effect re-runs only
 * when either changes.
 */
function useContentKey(
  section: LiquidSectionPlacement,
  themeSettings: Record<string, unknown>,
): string {
  return JSON.stringify({ section, themeSettings })
}

type ContentKey = { section: LiquidSectionPlacement; themeSettings: Record<string, unknown> }

/** How long settings must stay still before the canvas asks for a fresh render. */
const SETTLE_MS = 180

/**
 * Muted videos in the section play while on screen, as the storefront's theme script would
 * start them (a hero video otherwise shows a dark poster here). No theme code runs: the canvas
 * only calls play()/pause() on the section's own muted videos, so nothing makes a sound.
 */
function playMutedVideos(box: HTMLElement): () => void {
  const videos = [...box.querySelectorAll<HTMLVideoElement>('video')].filter(
    (v) => v.muted || v.hasAttribute('muted'),
  )
  if (videos.length === 0) return () => undefined
  const view = box.ownerDocument.defaultView
  if (!view?.IntersectionObserver) return () => undefined
  const observer = new view.IntersectionObserver((entries) => {
    for (const e of entries) {
      const video = e.target as HTMLVideoElement
      if (e.isIntersecting && video.offsetParent !== null) {
        video.muted = true
        video.play().catch(() => undefined)
      } else video.pause()
    }
  })
  for (const v of videos) observer.observe(v)
  return () => observer.disconnect()
}

/**
 * One imported Shopify section on the Customize canvas: the theme's own Liquid,
 * rendered on the server with this store's data. Scripts never run here (the canvas
 * shares the admin's origin); the storefront runs them. Re-renders when its settings
 * change, after a short pause so typing does not send a request per key.
 */
export default function LiquidCanvasSection({ themeId, section }: LiquidCanvasSectionProps) {
  // Hooks
  const themeSettings = useLiquidThemeSettings()
  const key = useContentKey(section, themeSettings)
  const [html, setHtml] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      const content = JSON.parse(key) as ContentKey
      renderLiquidCanvas(themeId, content.section, content.themeSettings).then(
        (next) => active && setHtml(next),
        () => active && setHtml(''),
      )
    }, SETTLE_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [themeId, key])

  useEffect(() => {
    if (!html || !box.current) return
    return playMutedVideos(box.current)
  }, [html])

  // Early returns
  if (html === null) return <div className="min-h-24" aria-busy="true" />

  // Render logic
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered Liquid of the merchant's own imported theme, scripts and inline handlers stripped by the API (`theme-import.service.ts`). */}
      <div ref={box} dangerouslySetInnerHTML={{ __html: html }} />
      <CanvasAppBlocks box={box} html={html} />
    </>
  )
}
