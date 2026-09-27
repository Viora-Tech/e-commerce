import type { GlobeMarker } from './types'

/**
 * Motion and input shared by both globes (cobe on the Home card, our own WebGL globe on the
 * Live view): auto-rotate that eases onto a focus point, drag to spin (with inertia) and tilt,
 * wheel / trackpad / touch-pinch zoom, and the per-frame placement of the accessible marker
 * buttons. The renderers differ only in how they draw a frame.
 */

const BASE_PHI_SPEED = 0.0022
const DRAG_SPEED = 0.005
const EASE_MS = 1400
const ZOOM_WHEEL_SENSITIVITY = 0.0016
const ZOOM_EASE = 0.2

/** Zoom clamps and how far a +/- button press moves the target. */
export const ZOOM_MIN = 0.6
export const ZOOM_MAX = 2.6
export const ZOOM_BUTTON_STEP = 0.25

/** How far a vertical drag may tilt the globe, in radians, so it never flips over a pole. */
const THETA_LIMIT = 1.1

export type GlobeMotion = {
  phi: number
  theta: number
  zoom: number
  /** Where zoom eases towards; buttons, wheel and pinch all move this. */
  zoomTarget: number
  zoomMax: number
  dragging: boolean
  pointerId: number | null
  lastX: number
  lastY: number
  velocity: number
  startedAt: number
  touches: Map<number, { x: number; y: number }>
  pinchStartDistance: number
  pinchStartZoom: number
}

/** A marker's position on screen, in CSS pixels from the container's top-left corner. */
export type ScreenSpot = { x: number; y: number; visible: boolean }

/** Ease-out cubic, 0..1 -> 0..1. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function clampZoom(value: number, max = ZOOM_MAX): number {
  return Math.min(max, Math.max(ZOOM_MIN, value))
}

function clampTheta(value: number): number {
  return Math.min(THETA_LIMIT, Math.max(-THETA_LIMIT, value))
}

/** Distance between two touch points, for pinch-to-zoom. */
function pinchDistance(points: Map<number, { x: number; y: number }>): number {
  const [a, b] = [...points.values()]
  if (!a || !b) return 0
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function createMotion(
  focus: [phi: number, theta: number],
  reducedMotion: boolean,
  zoomMax = ZOOM_MAX,
): GlobeMotion {
  return {
    phi: reducedMotion ? focus[0] : 0,
    theta: reducedMotion ? focus[1] : 0.28,
    zoom: 1,
    zoomTarget: 1,
    zoomMax,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    velocity: 0,
    startedAt: performance.now(),
    touches: new Map(),
    pinchStartDistance: 0,
    pinchStartZoom: 1,
  }
}

/** One frame of motion: the ease onto `focus`, then auto-rotate plus drag inertia, then the
 * zoom ease. Reduced motion skips the ease and auto-rotate and snaps zoom. */
export function stepMotion(
  s: GlobeMotion,
  now: number,
  focus: [phi: number, theta: number],
  reducedMotion: boolean,
) {
  if (!s.dragging) {
    if (!reducedMotion) {
      const easeT = Math.min(1, (now - s.startedAt) / EASE_MS)
      if (easeT < 1) {
        s.phi = focus[0] * easeOutCubic(easeT)
        s.theta = focus[1] * easeOutCubic(easeT)
      } else {
        s.phi += BASE_PHI_SPEED + s.velocity
      }
    }
    s.velocity *= 0.92
  }
  s.zoom = reducedMotion ? s.zoomTarget : s.zoom + (s.zoomTarget - s.zoom) * ZOOM_EASE
}

/**
 * Wires drag (spin and tilt), touch pinch and wheel zoom to the canvas; returns the cleanup.
 * Touch keeps vertical swipes for page scroll (`pan-y`), and the wheel listener only prevents
 * the page's own scroll while the pointer is over the canvas.
 */
export function attachControls(
  canvas: HTMLCanvasElement,
  s: GlobeMotion,
  reducedMotion: boolean,
): () => void {
  const onPointerDown = (e: PointerEvent) => {
    s.dragging = true
    s.pointerId = e.pointerId
    s.lastX = e.clientX
    s.lastY = e.clientY
    canvas.style.cursor = 'grabbing'
    canvas.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!s.dragging || e.pointerId !== s.pointerId) return
    const delta = e.clientX - s.lastX
    s.lastX = e.clientX
    // Spin slows as you zoom in, so the ground under the pointer keeps pace with it.
    s.phi += (delta * DRAG_SPEED) / Math.max(1, s.zoom)
    s.theta = clampTheta(s.theta + ((e.clientY - s.lastY) * DRAG_SPEED) / Math.max(1, s.zoom))
    s.lastY = e.clientY
    s.velocity = reducedMotion ? 0 : (delta * DRAG_SPEED * 0.5) / Math.max(1, s.zoom)
  }
  const onPointerEnd = (e: PointerEvent) => {
    if (e.pointerId !== s.pointerId) return
    s.dragging = false
    s.pointerId = null
    canvas.style.cursor = 'grab'
  }
  // Pinch starts as two simultaneous pointers, so rotation is suspended while it runs.
  const onTouchStart = (e: TouchEvent) => {
    for (const t of e.changedTouches) s.touches.set(t.identifier, { x: t.clientX, y: t.clientY })
    if (s.touches.size === 2) {
      s.dragging = false
      s.pinchStartDistance = pinchDistance(s.touches)
      s.pinchStartZoom = s.zoomTarget
    }
  }
  const onTouchMove = (e: TouchEvent) => {
    if (s.touches.size !== 2) return
    e.preventDefault()
    for (const t of e.changedTouches) {
      if (s.touches.has(t.identifier)) s.touches.set(t.identifier, { x: t.clientX, y: t.clientY })
    }
    if (s.pinchStartDistance > 0) {
      const ratio = pinchDistance(s.touches) / s.pinchStartDistance
      s.zoomTarget = clampZoom(s.pinchStartZoom * ratio, s.zoomMax)
    }
  }
  const onTouchEnd = (e: TouchEvent) => {
    for (const t of e.changedTouches) s.touches.delete(t.identifier)
    if (s.touches.size < 2) s.pinchStartDistance = 0
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    s.zoomTarget = clampZoom(s.zoomTarget - e.deltaY * ZOOM_WHEEL_SENSITIVITY, s.zoomMax)
  }

  canvas.style.cursor = 'grab'
  canvas.style.touchAction = 'pan-y'
  const on = [
    [canvas, 'pointerdown', onPointerDown],
    [window, 'pointermove', onPointerMove],
    [window, 'pointerup', onPointerEnd],
    [window, 'pointercancel', onPointerEnd],
    [canvas, 'touchstart', onTouchStart, { passive: true }],
    [canvas, 'touchmove', onTouchMove, { passive: false }],
    [canvas, 'touchend', onTouchEnd],
    [canvas, 'touchcancel', onTouchEnd],
    [canvas, 'wheel', onWheel, { passive: false }],
  ] as [EventTarget, string, (e: never) => void, AddEventListenerOptions?][]
  for (const [target, type, fn, options] of on) {
    target.addEventListener(type, fn as EventListener, options)
  }
  return () => {
    for (const [target, type, fn] of on) target.removeEventListener(type, fn as EventListener)
  }
}

/** Places (and keeps positioned) one invisible-but-real, focusable button per marker over the
 * canvas, so hover and keyboard focus both work, and re-anchors the tooltip to the active
 * marker when there is one. `spot` gives each marker's current screen position. */
export function positionOverlay(
  container: HTMLDivElement,
  markers: GlobeMarker[],
  activeId: string | null,
  spot: (marker: GlobeMarker) => ScreenSpot,
) {
  const tooltip = container.querySelector<HTMLDivElement>('[data-globe-tooltip]')
  for (const marker of markers) {
    const el = container.querySelector<HTMLButtonElement>(`[data-marker-id="${marker.id}"]`)
    if (!el) continue
    const { x, y, visible } = spot(marker)
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
    el.style.opacity = visible ? '1' : '0'
    el.style.pointerEvents = visible ? 'auto' : 'none'
    if (tooltip && marker.id === activeId) {
      tooltip.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 0.5rem))`
      tooltip.style.opacity = visible ? '1' : '0'
    }
  }
}
