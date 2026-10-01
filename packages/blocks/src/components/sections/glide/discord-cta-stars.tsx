'use client'

import { useEffect, useRef } from 'react'
import { startStarfield } from './discord-cta-starfield'

// Port of assets/discord-stars.js: a canvas of slowly rising stars behind the band's copy.
export default function DiscordCtaStars() {
  // Hooks
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    return startStarfield(el)
  }, [])

  // Render logic
  // biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas is not focusable; it is decorative.
  return <canvas ref={canvas} className="discord-cta__stars" aria-hidden="true" />
}
