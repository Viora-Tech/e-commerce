'use client'

import { cn } from '@commerce/ui/lib/utils'
import { useEffect, useRef } from 'react'
import {
  attachControls,
  clampZoom,
  createMotion,
  type GlobeMotion,
  positionOverlay,
  stepMotion,
  ZOOM_BUTTON_STEP,
} from './globe-controls'
import GlobeOverlay from './globe-overlay'
import { readPalette } from './globe-palette'
import type { GlobeCanvasProps } from './types'
import { anglesFor, createGlobeRenderer, rotate, rotation } from './webgl/globe-renderer'
import { buildArcPoints, buildMarkerPoints, markerVector } from './webgl/overlay-points'

const PULSE_MS = 1800
const REVEAL_MS = 900

/** Deeper than cobe's 2.6: the land map stays sharp, so zooming in on India is worth it. */
const ZOOM_MAX = 4

/** Globe radius as a share of the canvas height at zoom 1 (cobe's fit). */
const RADIUS = 0.4

/**
 * Natural Earth 1:10m countries, India point of view, 2048x1024: land in red, country borders in
 * green (see scripts/globe/make-globe-map.py). Served from public/.
 */
const LAND_MAP_SRC = '/globe/globe-2048.png'

/**
 * Our own WebGL globe for the Live view (cobe stays on the Home card). Same props, markers,
 * arcs, drag/tilt, zoom and reduced-motion behaviour as `LiveGlobeCanvas`, but land is drawn
 * as smooth filled continents from the land map with faint 15° grid lines instead of dots, so
 * it never shimmers (dots at 3-6 px beat against the screen's pixel grid) and stays sharp
 * when zoomed in on India.
 */
export default function WebglGlobeCanvas({
  markers,
  arcs,
  reducedMotion,
  dark,
  focus,
  activeId,
  onActiveChange,
  className,
  shiftX = 0,
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
    const renderer = canvas && createGlobeRenderer(canvas)
    if (!canvas || !container || !renderer) return

    const target = anglesFor(focus.lat, focus.lng)
    const s = createMotion(target, reducedMotion, ZOOM_MAX)
    // A theme or focus change rebuilds the globe; keep the zoom the merchant asked for.
    s.zoomTarget = motionRef.current?.zoomTarget ?? 1
    motionRef.current = s
    const palette = readPalette(dark)
    const overlayPalette = { marker: palette.marker, arc: palette.arc, newest: palette.arcNewest }
    let revealStartedAt = performance.now()
    let lastNewestId = markersRef.current.find((m) => m.isNewest)?.id ?? null
    let shownArcs: typeof arcs | null = null
    let alive = true
    const landImage = new Image()
    landImage.src = LAND_MAP_SRC
    landImage
      .decode()
      .then(() => alive && renderer.setLandMap(landImage))
      .catch(() => {
        // No land map: the sphere, markers and arcs still draw.
      })

    let rafId = 0
    const tick = () => {
      const now = performance.now()
      stepMotion(s, now, target, reducedMotion)

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { clientWidth: w, clientHeight: h } = container
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const radius = RADIUS * h * s.zoom
      const cx = w / 2 + shiftX * w
      const cy = h / 2

      if (arcsRef.current !== shownArcs) {
        shownArcs = arcsRef.current
        renderer.setPoints(0, buildArcPoints(shownArcs, overlayPalette))
      }
      const newestId = markersRef.current.find((m) => m.isNewest)?.id ?? null
      if (newestId !== lastNewestId) {
        lastNewestId = newestId
        revealStartedAt = now
      }
      const reveal = reducedMotion ? 1 : Math.min(1, (now - revealStartedAt) / REVEAL_MS)
      const pulse = reducedMotion ? 1 : 0.55 + 0.45 * Math.abs(Math.sin((now / PULSE_MS) * Math.PI))
      renderer.setPoints(1, buildMarkerPoints(markersRef.current, overlayPalette, pulse, reveal))

      const m = rotation(s.phi, s.theta)
      renderer.draw({
        cx: cx * dpr,
        cy: cy * dpr,
        radius: radius * dpr,
        rotation: m,
        pointScale: (radius / Math.max(1, s.zoom)) * dpr,
        dark,
        base: palette.base,
        glow: palette.glow,
      })

      positionOverlay(container, markersRef.current, activeIdRef.current, (marker) => {
        const [x, y, z] = rotate(m, markerVector(marker))
        const sx = cx + x * radius
        const sy = cy - y * radius
        const inView = sx > -8 && sx < w + 8 && sy > -8 && sy < h + 8
        return { x: sx, y: sy, visible: inView && (z >= 0 || x * x + y * y > 1) }
      })
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    const detach = attachControls(canvas, s, reducedMotion)

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      detach()
      renderer.destroy()
    }
    // Re-run on theme/focus changes; markers/arcs update through the refs above so drag state
    // and the reveal/pulse animation are not interrupted by every new-order poll.
  }, [dark, reducedMotion, focus.lat, focus.lng, shiftX])

  // Event handlers
  const handleZoom = (direction: -1 | 0 | 1) => {
    const s = motionRef.current
    if (!s) return
    s.zoomTarget =
      direction === 0
        ? 1
        : clampZoom(s.zoomTarget + direction * ZOOM_BUTTON_STEP * s.zoomTarget, ZOOM_MAX)
  }

  // Render logic
  /* Kept fresh every render, read only inside the rAF loop above. */
  markersRef.current = markers
  arcsRef.current = arcs
  activeIdRef.current = activeId

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full select-none', className ?? 'aspect-square')}
    >
      <canvas ref={canvasRef} aria-hidden className="size-full [contain:layout_paint_size]" />
      <GlobeOverlay
        markers={markers}
        activeId={activeId}
        onActiveChange={onActiveChange}
        onZoom={handleZoom}
      />
    </div>
  )
}
