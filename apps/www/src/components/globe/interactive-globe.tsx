'use client'

import {
  attachControls,
  createMotion,
  type GlobeMotion,
  stepMotion,
} from '@commerce/ui/globe/controls'
import type { GlobeMarker } from '@commerce/ui/globe/types'
import { dotRadiusPx, pickDotRows } from '@commerce/ui/globe/webgl/dot-layout'
import {
  anglesFor,
  createGlobeRenderer,
  rotate,
  rotation,
} from '@commerce/ui/globe/webgl/globe-renderer'
import { buildMarkerPoints, markerVector } from '@commerce/ui/globe/webgl/overlay-points'
import { type MutableRefObject, useEffect, useEffectEvent, useRef, useState } from 'react'
import { DEMO_ORDERS, globeContent } from '@/data/demo-orders'
import type { GlobeApi } from './globe-api'

type InteractiveGlobeProps = {
  /** Show the pulsing demo order pins and the occasional order chip. */
  pins: boolean
  /** Receives the globe's controls (turn to India, release, pin positions). */
  apiRef?: MutableRefObject<GlobeApi | null>
  /** Called once the land map has loaded and the first frame is drawn. */
  onReady: () => void
}

const RESUME_AFTER_MS = 3000
const AUTO_ROTATE_SCALE = 0.35
const CHIP_EVERY_MS = 2800
const ZOOM_MAX = 1.8
// Looking from slightly south of India so India sits in the visible top of the sphere.
const FOCUS = { lat: -10, lng: 74 }
const PIN_SCALE = 0.4
const FOCUS_ZOOM = 1.12
const SPHERE_RADIUS = 0.393
const SPHERE_CENTER_Y = 0.459
const WHITE: [number, number, number] = [1, 1, 1]
const PALETTE = { marker: WHITE, arc: WHITE, newest: WHITE }

const MARKERS: GlobeMarker[] = DEMO_ORDERS.map((order) => ({
  id: order.id,
  lat: order.lat,
  lng: order.lng,
  label: order.city,
  isNewest: false,
  tooltip: null,
}))

/**
 * The hero globe: the shared WebGL renderer and controls from `@commerce/ui/globe`, framed so the
 * top of the sphere shows (like the Figma raster). Drag to turn with inertia, slow auto-rotate that
 * pauses while dragging and resumes after 3 s, zoom only on pinch or ctrl+wheel. The pins and
 * chips are DEMO data (`data/demo-orders.ts`).
 */
export default function InteractiveGlobe({ pins, apiRef, onReady }: InteractiveGlobeProps) {
  // Hooks
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chipRef = useRef<HTMLDivElement>(null)
  const chipIdRef = useRef<string | null>(null)
  const motionRef = useRef<GlobeMotion | null>(null)
  const [chipId, setChipId] = useState<string | null>(null)
  const reportReady = useEffectEvent(onReady)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const renderer = canvas && createGlobeRenderer(canvas)
    if (!canvas || !container || !renderer) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = anglesFor(FOCUS.lat, FOCUS.lng)
    const s = createMotion(target, reduced, ZOOM_MAX)
    motionRef.current = s
    let releasedAt = Number.NEGATIVE_INFINITY
    let focusing = false
    let frame: {
      m: ReturnType<typeof rotation>
      cx: number
      cy: number
      radius: number
      w: number
      h: number
    } | null = null
    let visible = true
    let alive = true
    let rafId = 0
    let reported = false

    const land = new Image()
    land.src = '/globe/globe-2048.png'
    land
      .decode()
      .then(() => {
        if (!alive) return
        renderer.setLandMap(land)
        if (!reported) {
          reported = true
          reportReady()
        }
      })
      .catch(() => {
        // No land map: the static fallback image stays visible.
      })

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      if (!visible || document.visibilityState !== 'visible') return
      const now = performance.now()
      const idle = !focusing && !s.dragging && now - releasedAt > RESUME_AFTER_MS
      stepMotion(s, now, target, reduced, idle && !reduced ? AUTO_ROTATE_SCALE : 0)
      if (focusing && !s.dragging) {
        // Ease round to India by the shortest way, and zoom in a touch.
        const delta = Math.atan2(Math.sin(target[0] - s.phi), Math.cos(target[0] - s.phi))
        s.phi += delta * 0.07
        s.theta += (target[1] - s.theta) * 0.07
        s.velocity = 0
        s.zoomTarget = FOCUS_ZOOM
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { clientWidth: w, clientHeight: h } = container
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      // Same framing as the Figma raster: the sphere is 0.786 of the box width, its top sits a
      // little below the box's top edge and its centre on the bottom edge, so only the top arc shows.
      const radius = w * SPHERE_RADIUS * s.zoom
      const cx = w / 2
      const cy = w * SPHERE_CENTER_Y
      const m = rotation(s.phi, s.theta)
      frame = { m, cx, cy, radius, w, h }
      const radiusDevicePx = radius * dpr
      const rows = pickDotRows(radiusDevicePx, dpr)
      const pulse = reduced ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(now / 900))
      const shown = chipIdRef.current

      renderer.setPoints(
        1,
        pins
          ? buildMarkerPoints(
              MARKERS.map((marker) => ({ ...marker, isNewest: marker.id === shown })),
              PALETTE,
              pulse,
              1,
            )
          : new Float32Array(),
      )
      renderer.draw({
        cx: cx * dpr,
        cy: cy * dpr,
        radius: radiusDevicePx,
        rotation: m,
        pointScale: w * SPHERE_RADIUS * dpr * PIN_SCALE,
        dark: true,
        base: [0.2, 0.2, 0.21],
        ocean: [0.03, 0.03, 0.035],
        glow: [0.9, 0.9, 0.92],
        layers: { borders: false, coastlines: false, grid: false, glow: true },
        style: 'dotted',
        dotRows: rows,
        dotRadiusPx: dotRadiusPx(rows, radiusDevicePx, dpr),
        sun: null,
        dashPeriodPx: 5 * dpr,
      })

      const chip = chipRef.current
      const order = DEMO_ORDERS.find((item) => item.id === shown)
      if (chip && order) {
        const [x, y, z] = rotate(m, markerVector(order))
        const sx = cx + x * radius
        const sy = cy - y * radius
        const inView = (z >= 0 || x * x + y * y > 1) && sx > 0 && sx < w && sy > 0 && sy < h
        chip.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, calc(-100% - 0.75rem))`
        chip.style.opacity = inView ? '1' : '0'
      }
    }
    rafId = requestAnimationFrame(tick)

    if (apiRef) {
      apiRef.current = {
        focusIndia: () => {
          focusing = true
        },
        release: () => {
          focusing = false
          s.zoomTarget = 1
          releasedAt = performance.now()
        },
        visiblePins: () => {
          if (!frame) return []
          const box = container.getBoundingClientRect()
          const { m, cx, cy, radius, w, h } = frame
          return DEMO_ORDERS.flatMap((order) => {
            const [x, y, z] = rotate(m, markerVector(order))
            const sx = cx + x * radius
            const sy = cy - y * radius
            const onSphere = z >= 0 && sx > 0 && sx < w && sy > 0 && sy < h
            return onSphere ? [{ id: order.id, x: box.left + sx, y: box.top + sy }] : []
          })
        },
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
    })
    observer.observe(container)
    const onRelease = () => {
      releasedAt = performance.now()
    }
    window.addEventListener('pointerup', onRelease)
    window.addEventListener('pointercancel', onRelease)
    const detach = attachControls(canvas, s, reduced, { wheelZoom: 'ctrl' })

    return () => {
      if (apiRef) apiRef.current = null
      alive = false
      cancelAnimationFrame(rafId)
      observer.disconnect()
      window.removeEventListener('pointerup', onRelease)
      window.removeEventListener('pointercancel', onRelease)
      detach()
      renderer.destroy()
    }
  }, [pins, apiRef])

  useEffect(() => {
    if (!pins) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let index = 0
    const show = () => {
      const order = DEMO_ORDERS[index % DEMO_ORDERS.length]
      index += 3
      chipIdRef.current = order?.id ?? null
      setChipId(order?.id ?? null)
    }
    show()
    const timer = setInterval(show, CHIP_EVERY_MS)
    return () => clearInterval(timer)
  }, [pins])

  // Render logic
  const order = DEMO_ORDERS.find((item) => item.id === chipId)

  return (
    <div ref={containerRef} className="absolute inset-0 select-none">
      <canvas ref={canvasRef} aria-hidden className="size-full" />
      {pins && order ? (
        <div
          ref={chipRef}
          key={order.id}
          aria-hidden
          data-demo={globeContent.demoLabel}
          className="pointer-events-none absolute top-0 left-0 opacity-0"
        >
          <span className="glass-panel animate-tour-in block rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap text-foreground">
            {globeContent.chipLabel(order)}
          </span>
        </div>
      ) : null}
    </div>
  )
}
