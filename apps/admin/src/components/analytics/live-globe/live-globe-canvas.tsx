'use client'

import {
  attachControls,
  clampZoom,
  createMotion,
  type GlobeMotion,
  positionOverlay,
  stepMotion,
  ZOOM_BUTTON_STEP,
} from '@commerce/ui/globe/controls'
import { locationToAngles, projectToView } from '@commerce/ui/globe/projection'
import { cn } from '@commerce/ui/lib/utils'
import createGlobe, { type Globe } from 'cobe'
import { useEffect, useRef } from 'react'
import GlobeOverlay from './globe-overlay'
import { readPalette } from './globe-palette'
import type { GlobeCanvasProps } from './types'

export type { GlobeArc, GlobeMarker } from './types'

const PULSE_MS = 1800
const REVEAL_MS = 900

/**
 * cobe's `offset` moves the centre by `offset * scale / 4` CSS pixels (its buffer is twice the
 * CSS size and the shift grows with scale), so this is the offset that pins the centre `px` right.
 */
function cobeOffset(px: number, zoom: number): [number, number] {
  return [(4 * px) / zoom, 0]
}

/**
 * The cobe canvas (Home card): dotted landmass, glow, accent markers and arcs, auto-rotate
 * that eases onto `focus` on mount, drag-to-spin with inertia, wheel/pinch/button zoom, and an
 * accessible overlay button per marker for the tooltip (hover or focus). cobe tops out at
 * about 32k dots; the Live view uses our own `webgl-globe-canvas` instead.
 *
 * Reduced motion turns off the zoom-ease and the auto-rotate/reveal animations, but dragging
 * to rotate still works either way.
 */
export default function LiveGlobeCanvas({
  markers,
  arcs,
  reducedMotion,
  dark,
  focus,
  activeId,
  onActiveChange,
  className,
  shiftX = 0,
  brand = false,
}: GlobeCanvasProps) {
  // Hooks
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef(markers)
  const arcsRef = useRef(arcs)
  const activeIdRef = useRef(activeId)
  const motionRef = useRef<GlobeMotion | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const target = locationToAngles(focus.lat, focus.lng)
    const s = createMotion(target, reducedMotion)
    // A theme or focus change rebuilds the globe; keep the zoom the merchant asked for.
    s.zoomTarget = motionRef.current?.zoomTarget ?? 1
    motionRef.current = s
    let revealStartedAt = performance.now()
    let lastNewestId = markersRef.current.find((m) => m.isNewest)?.id ?? null
    const palette = readPalette(dark, undefined, brand)

    const globe: Globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width: canvas.clientWidth * 2,
      height: canvas.clientHeight * 2,
      phi: s.phi,
      theta: s.theta,
      dark: dark ? 1 : 0,
      diffuse: 1.15,
      scale: 1,
      offset: cobeOffset(shiftX * canvas.clientWidth, 1),
      // Dense enough to show the detailed land map (patches/cobe@2.0.1.patch) coast by coast.
      mapSamples: 32000,
      mapBrightness: dark ? 4.5 : 5.5,
      baseColor: palette.base,
      markerColor: palette.marker,
      glowColor: palette.glow,
      arcColor: palette.arc,
      arcWidth: 0.55,
      arcHeight: 0.32,
      markerElevation: 0.02,
      opacity: 0.94,
      markers: [],
      arcs: [],
    })

    // cobe 2's `update` is the whole render loop's entry point: it does not call back on its
    // own, so this rAF loop drives phi/theta/scale each frame and re-sends markers/arcs.
    let rafId = 0
    const tick = () => {
      const now = performance.now()
      stepMotion(s, now, target, reducedMotion)

      const newestId = markersRef.current.find((m) => m.isNewest)?.id ?? null
      if (newestId !== lastNewestId) {
        lastNewestId = newestId
        revealStartedAt = now
      }
      const revealT = reducedMotion ? 1 : Math.min(1, (now - revealStartedAt) / REVEAL_MS)
      const pulse = reducedMotion ? 1 : 0.55 + 0.45 * Math.abs(Math.sin((now / PULSE_MS) * Math.PI))

      const { clientWidth: w, clientHeight: h } = container
      const shiftPx = shiftX * canvas.clientWidth
      globe.update({
        phi: s.phi,
        theta: s.theta,
        scale: s.zoom,
        offset: cobeOffset(shiftPx, s.zoom),
        markers: markersRef.current.map((m) => ({
          location: [m.lat, m.lng] as [number, number],
          size: m.isNewest ? 0.09 * (0.6 + 0.4 * pulse) * revealT : 0.045,
          color: m.isNewest ? palette.arcNewest : palette.marker,
        })),
        arcs: arcsRef.current.map((a) => ({
          from: [a.fromLat, a.fromLng] as [number, number],
          to: [a.toLat, a.toLng] as [number, number],
          color: a.isNewest ? palette.arcNewest : palette.arc,
        })),
      })

      const radius = (Math.min(w, h) / 2) * 0.92 * s.zoom
      positionOverlay(container, markersRef.current, activeIdRef.current, (m) => {
        const p = projectToView(m.lat, m.lng, s.phi, s.theta)
        return {
          x: w / 2 + shiftPx + p.x * radius,
          y: h / 2 - p.y * radius,
          visible: p.visible && Math.abs(p.x) < 1.3 && Math.abs(p.y) < 1.3,
        }
      })
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // Motion spec 09: pause the auto-rotate/reveal/pulse loop while the tab is hidden so
    // no animation time passes there; on return shift the time bases forward by the gap.
    let hiddenAt: number | null = null
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = performance.now()
        cancelAnimationFrame(rafId)
        rafId = 0
      } else if (hiddenAt !== null) {
        const gap = performance.now() - hiddenAt
        hiddenAt = null
        s.startedAt += gap
        revealStartedAt += gap
        if (!rafId) rafId = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const detach = attachControls(canvas, s, reducedMotion)
    const handleResize = () => {
      globe.update({ width: canvas.clientWidth * 2, height: canvas.clientHeight * 2 })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(rafId)
      globe.destroy()
      detach()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('resize', handleResize)
    }
    // Re-run on theme/focus changes; markers/arcs update through the refs above so drag state
    // and the reveal/pulse animation are not interrupted by every new-order poll.
  }, [dark, reducedMotion, focus.lat, focus.lng, shiftX, brand])

  // Event handlers
  const handleZoom = (direction: -1 | 0 | 1) => {
    const s = motionRef.current
    if (!s) return
    s.zoomTarget = direction === 0 ? 1 : clampZoom(s.zoomTarget + direction * ZOOM_BUTTON_STEP)
  }

  // Render logic
  /* Kept fresh every render, read only inside the rAF loop above (not a dependency of it, so
     new marker/arc data or an active id change never interrupts the drag/animation state). */
  markersRef.current = markers
  arcsRef.current = arcs
  activeIdRef.current = activeId

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full select-none', className ?? 'aspect-square')}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="size-full [contain:layout_paint_size]"
        style={{ width: '100%', height: '100%' }}
      />
      <GlobeOverlay
        markers={markers}
        activeId={activeId}
        onActiveChange={onActiveChange}
        onZoom={brand ? undefined : handleZoom}
      />
    </div>
  )
}
