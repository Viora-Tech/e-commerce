'use client'

import createGlobe, { type Globe } from 'cobe'
import { type ReactNode, useEffect, useRef } from 'react'
import { type Rgb01, readCssColorVar } from '@/lib/cobe-colors'
import { locationToAngles, projectToView } from './projection'

export type GlobeMarker = {
  id: string
  lat: number
  lng: number
  label: string
  isNewest: boolean
  /** City, order number and amount; shown next to the marker on hover or focus. */
  tooltip: ReactNode
}

export type GlobeArc = {
  id: string
  fromLat: number
  fromLng: number
  toLat: number
  toLng: number
  isNewest: boolean
}

type LiveGlobeCanvasProps = {
  markers: GlobeMarker[]
  arcs: GlobeArc[]
  reducedMotion: boolean
  dark: boolean
  focus: { lat: number; lng: number }
  activeId: string | null
  onActiveChange: (id: string | null) => void
}

const BASE_PHI_SPEED = 0.0022
const DRAG_SPEED = 0.005
const EASE_MS = 1400
const PULSE_MS = 1800
const REVEAL_MS = 900

/** Ease-out cubic, 0..1 -> 0..1. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/** cobe wants `[0,0,0]`..`[1,1,1]` colours; these are the tokens the whole dashboard uses. */
function readPalette(dark: boolean): {
  base: Rgb01
  marker: Rgb01
  glow: Rgb01
  arc: Rgb01
  arcNewest: Rgb01
} {
  const fallbackBase: Rgb01 = dark ? [0.45, 0.45, 0.47] : [0.6, 0.6, 0.62]
  const fallbackPrimary: Rgb01 = dark ? [0.19, 0.82, 0.34] : [0.31, 0.65, 0.46]
  return {
    base: readCssColorVar('--muted-foreground', fallbackBase),
    marker: readCssColorVar('--primary', fallbackPrimary),
    glow: readCssColorVar('--primary', fallbackPrimary),
    arc: readCssColorVar('--primary', fallbackPrimary),
    arcNewest: readCssColorVar('--chart-2', fallbackPrimary),
  }
}

/** Places (and keeps positioned) one invisible-but-real, focusable button per marker over the
 * canvas, so hover and keyboard focus both work; screen position is recomputed every frame
 * from the globe's current rotation. Also re-anchors the tooltip to the active marker, when
 * there is one. */
function positionOverlay(
  container: HTMLDivElement,
  markers: GlobeMarker[],
  phi: number,
  theta: number,
  activeId: string | null,
) {
  const { clientWidth: w, clientHeight: h } = container
  const radius = (Math.min(w, h) / 2) * 0.92
  const tooltip = container.querySelector<HTMLDivElement>('[data-globe-tooltip]')
  for (const marker of markers) {
    const el = container.querySelector<HTMLButtonElement>(`[data-marker-id="${marker.id}"]`)
    if (!el) continue
    const p = projectToView(marker.lat, marker.lng, phi, theta)
    const x = w / 2 + p.x * radius
    const y = h / 2 - p.y * radius
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
    el.style.opacity = p.visible ? '1' : '0'
    el.style.pointerEvents = p.visible ? 'auto' : 'none'
    if (tooltip && marker.id === activeId) {
      tooltip.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 0.5rem))`
      tooltip.style.opacity = p.visible ? '1' : '0'
    }
  }
}

/**
 * The cobe canvas itself: dotted landmass, glow, accent markers and arcs, auto-rotate that
 * eases onto `focus` on mount, drag-to-spin with inertia, and an accessible overlay button per
 * marker for the tooltip (hover or focus). No borders or polygons are drawn — cobe's world map
 * is dots only.
 */
export default function LiveGlobeCanvas({
  markers,
  arcs,
  reducedMotion,
  dark,
  focus,
  activeId,
  onActiveChange,
}: LiveGlobeCanvasProps) {
  // Hooks
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef(markers)
  const arcsRef = useRef(arcs)
  const activeIdRef = useRef(activeId)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const [focusPhi, focusTheta] = locationToAngles(focus.lat, focus.lng)
    const state = {
      phi: reducedMotion ? focusPhi : 0,
      theta: reducedMotion ? focusTheta : 0.28,
      dragging: false,
      pointerId: null as number | null,
      lastX: 0,
      velocity: 0,
      startedAt: performance.now(),
      revealStartedAt: performance.now(),
      lastNewestId: markersRef.current.find((m) => m.isNewest)?.id ?? null,
    }
    const palette = readPalette(dark)

    const globe: Globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width: canvas.clientWidth * 2,
      height: canvas.clientHeight * 2,
      phi: state.phi,
      theta: state.theta,
      dark: dark ? 1 : 0,
      diffuse: 1.15,
      scale: 1,
      mapSamples: 14000,
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
    // own, so this rAF loop drives phi/theta each frame (autorotate/ease/drag) and re-sends
    // markers/arcs, exactly like cobe's own demos.
    let rafId = 0
    const tick = () => {
      const now = performance.now()
      const elapsed = now - state.startedAt

      if (!state.dragging) {
        if (!reducedMotion) {
          const easeT = Math.min(1, elapsed / EASE_MS)
          if (easeT < 1) {
            state.phi = focusPhi * easeOutCubic(easeT)
            state.theta = focusTheta * easeOutCubic(easeT)
          } else {
            state.phi += BASE_PHI_SPEED + state.velocity
          }
        }
        state.velocity *= 0.92
      }

      const newestId = markersRef.current.find((m) => m.isNewest)?.id ?? null
      if (newestId !== state.lastNewestId) {
        state.lastNewestId = newestId
        state.revealStartedAt = now
      }
      const revealT = reducedMotion ? 1 : Math.min(1, (now - state.revealStartedAt) / REVEAL_MS)
      const pulse = reducedMotion ? 1 : 0.55 + 0.45 * Math.abs(Math.sin((now / PULSE_MS) * Math.PI))

      globe.update({
        phi: state.phi,
        theta: state.theta,
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

      positionOverlay(container, markersRef.current, state.phi, state.theta, activeIdRef.current)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    const handlePointerDown = (e: PointerEvent) => {
      state.dragging = true
      state.pointerId = e.pointerId
      state.lastX = e.clientX
      canvas.style.cursor = 'grabbing'
      canvas.setPointerCapture(e.pointerId)
    }
    const handlePointerMove = (e: PointerEvent) => {
      if (!state.dragging || e.pointerId !== state.pointerId) return
      const delta = e.clientX - state.lastX
      state.lastX = e.clientX
      state.phi += delta * DRAG_SPEED
      state.velocity = reducedMotion ? 0 : delta * DRAG_SPEED * 0.5
    }
    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== state.pointerId) return
      state.dragging = false
      state.pointerId = null
      canvas.style.cursor = 'grab'
    }
    canvas.style.cursor = 'grab'
    canvas.style.touchAction = 'pan-y'
    canvas.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)

    const handleResize = () => {
      globe.update({ width: canvas.clientWidth * 2, height: canvas.clientHeight * 2 })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(rafId)
      globe.destroy()
      canvas.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      window.removeEventListener('resize', handleResize)
    }
    // Re-run on theme/focus changes; markers/arcs update through the refs above so drag state
    // and the reveal/pulse animation are not interrupted by every new-order poll.
  }, [dark, reducedMotion, focus.lat, focus.lng])

  // Event handlers
  const handleMarkerEnter = (id: string) => onActiveChange(id)
  const handleMarkerLeave = (id: string) => {
    if (activeId === id) onActiveChange(null)
  }

  // Render logic
  /* Kept fresh every render, read only inside the rAF loop above (not a dependency of it, so
     new marker/arc data or an active id change never interrupts the drag/animation state). */
  markersRef.current = markers
  arcsRef.current = arcs
  activeIdRef.current = activeId
  const active = markers.find((m) => m.id === activeId)

  return (
    <div ref={containerRef} className="relative aspect-square w-full select-none">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="size-full [contain:layout_paint_size]"
        style={{ width: '100%', height: '100%' }}
      />
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          data-marker-id={m.id}
          aria-label={m.label}
          className="absolute top-0 left-0 size-4 rounded-full opacity-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerEnter={() => handleMarkerEnter(m.id)}
          onPointerLeave={() => handleMarkerLeave(m.id)}
          onFocus={() => handleMarkerEnter(m.id)}
          onBlur={() => handleMarkerLeave(m.id)}
        />
      ))}
      {active ? (
        <div
          data-globe-tooltip
          role="tooltip"
          className="pointer-events-none absolute top-0 left-0 z-10 min-w-max rounded-lg border border-border bg-popover px-3 py-2 text-caption shadow-lift transition-opacity"
        >
          {active.tooltip}
        </div>
      ) : null}
    </div>
  )
}
