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
import { DASH_PERIOD_CSS_PX } from '@commerce/ui/globe/webgl/border-dash'
import {
  type BorderPoint,
  buildBorderStrokePoints,
  decodeBorderPoints,
} from '@commerce/ui/globe/webgl/border-points'
import {
  anglesFor,
  createGlobeRenderer,
  rotate,
  rotation,
  toVector,
} from '@commerce/ui/globe/webgl/globe-renderer'
import {
  buildArcPoints,
  buildMarkerPoints,
  markerVector,
} from '@commerce/ui/globe/webgl/overlay-points'
import { pickSpriteDotSamples, spriteDotRadiusPx } from '@commerce/ui/globe/webgl/sprite-dots'
import { subsolarPoint } from '@commerce/ui/globe/webgl/sun-position'
import { cn } from '@commerce/ui/lib/utils'
import { useEffect, useRef } from 'react'
import GlobeOverlay from './globe-overlay'
import { readPalette } from './globe-palette'
import { defaultGlobeSettings, type GlobeStartView, saveLastZoom } from './globe-settings'
import GlobeSettingsPanel from './globe-settings-panel'
import type { GlobeCanvasProps } from './types'

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

/** "Look > Border style: Dotted"'s points, built offline by
 * `scripts/globe/make-globe-borders.py` from the same India point-of-view data as the map
 * above. Only fetched once it is actually selected. */
const BORDERS_SRC = '/globe/borders.bin'

/** The "Motion > Speed" setting, as a multiplier over the globes' shared base auto-rotate
 * speed (see `globe-controls.ts`). */
const MOTION_SPEED_SCALE = { slow: 0.5, normal: 1, fast: 2 } as const

/** How often (ms) the remembered zoom is written to localStorage while it keeps changing. */
const ZOOM_SAVE_INTERVAL_MS = 1000

/** "Start view: Whole world"'s default zoom: further out than the India/my-location default
 * of 1, so the globe reads as a small planet rather than a close-up. */
const WORLD_START_ZOOM = 0.65

/**
 * "Look > Style: Dotted": cobe's evenly spread dots like the Home card (`live-globe-canvas.tsx`),
 * drawn as round anti-aliased sprites in the palette's land colour (`spriteDots` in
 * `globe-renderer.ts`). cobe's fixed 32k dots and 4.5x brightness turned into blocky white
 * blobs at this size, so the count follows the globe's size and the colour is used as is.
 * `spacing` is the gap between dot centres at zoom 1 (CSS px), `fill` the dot radius as a share
 * of it (cobe's is about 0.38). `diffuse` is cobe's: how fast dots dim towards the rim.
 */
const DOT_SIZES = {
  fine: { spacing: 3.4, fill: 0.3 },
  medium: { spacing: 4.4, fill: 0.34 },
  bold: { spacing: 6, fill: 0.38 },
} as const
const DOT_DIFFUSE = 1.15

/**
 * Our own WebGL globe for the Live view (cobe stays on the Home card). Same props, markers,
 * arcs, drag/tilt, zoom and reduced-motion behaviour as `LiveGlobeCanvas`. By default it looks
 * like the Home card (round palette-coloured dots, `DOT_SIZES`); "Solid land" draws smooth filled continents
 * from the land map instead, which stay sharp when zoomed in on India, with optional
 * coastlines, borders and 15° grid lines.
 *
 * `settings` (the "Globe settings" panel, only ever passed by the Live view hero) is read every
 * frame from a ref, never as an effect dependency: every layer toggle, colour, style and data
 * option applies on the next frame as plain uniforms, without ever tearing down and rebuilding
 * the WebGL context.
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
  settings,
  onSettingsChange,
  onSettingsReset,
}: GlobeCanvasProps) {
  // Hooks
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef(markers)
  const arcsRef = useRef(arcs)
  const activeIdRef = useRef(activeId)
  const motionRef = useRef<GlobeMotion | null>(null)
  const settingsRef = useRef(settings ?? defaultGlobeSettings(reducedMotion))
  const startViewRef = useRef<GlobeStartView | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const renderer = canvas && createGlobeRenderer(canvas)
    if (!canvas || !container || !renderer) return

    const target = anglesFor(focus.lat, focus.lng)
    const s = createMotion(target, reducedMotion, ZOOM_MAX)
    const initial = settingsRef.current
    const defaultZoom = initial.motion.startView === 'world' ? WORLD_START_ZOOM : 1
    // A theme or focus change rebuilds the globe; keep the zoom the merchant asked for. A new
    // "Start view" starts from that view's own zoom; the first load, with "Remember last zoom"
    // on, from the one saved on their last visit.
    const previous = motionRef.current
    const sameView = startViewRef.current === initial.motion.startView
    startViewRef.current = initial.motion.startView
    s.zoomTarget =
      previous && sameView
        ? previous.zoomTarget
        : !previous && initial.motion.rememberZoom
          ? clampZoom(initial.lastZoom, ZOOM_MAX)
          : defaultZoom
    motionRef.current = s
    let revealStartedAt = performance.now()
    let lastNewestId = markersRef.current.find((m) => m.isNewest)?.id ?? null
    let shownArcs: typeof arcs | null = null
    let shownArcsOn: boolean | null = null
    let lastSavedZoom = s.zoomTarget
    let lastZoomSaveAt = 0
    let alive = true
    const landImage = new Image()
    landImage.src = LAND_MAP_SRC
    landImage
      .decode()
      .then(() => alive && renderer.setLandMap(landImage))
      .catch(() => {
        // No land map: the sphere, markers and arcs still draw.
      })

    // Border dashes: fetched lazily, only once "Border style: Dashed" is actually picked (it
    // may never be), and only the once even if the setting is flipped on and off again. The
    // whole (dense) point set is uploaded once the fetch resolves; the dash on/off pattern
    // itself is entirely the shader's job every frame (`DASH`/`DP` in `globe-renderer.ts`), so
    // there is nothing to recompute here as the globe zooms.
    let borderPoints: BorderPoint[] | null = null
    let borderPointsRequested = false
    let borderPointsUploaded = false
    let uploadedBorderColorKey: string | null = null
    const loadBorderPointsIfNeeded = () => {
      if (borderPointsRequested) return
      borderPointsRequested = true
      fetch(BORDERS_SRC)
        .then((res) => {
          if (!res.ok) throw new Error(`Globe borders: HTTP ${res.status}`)
          return res.arrayBuffer()
        })
        .then((buffer) => {
          if (alive) borderPoints = decodeBorderPoints(buffer)
        })
        .catch((err) => {
          // No border dashes this session; the solid border (if on) still draws.
          console.warn(err)
        })
    }

    let paletteLook = settingsRef.current.look
    let palette = readPalette(dark, paletteLook, true)
    let rafId = 0
    /** Off screen (scrolled past) or in a hidden tab, the globe draws nothing. */
    let onScreen = true
    const shouldRun = () => onScreen && document.visibilityState === 'visible'
    const tick = () => {
      const now = performance.now()
      const live = settingsRef.current
      const speedScale = live.motion.autoRotate ? MOTION_SPEED_SCALE[live.motion.speed] : 0
      stepMotion(s, now, target, reducedMotion, speedScale)

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { clientWidth: w, clientHeight: h } = container
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const baseRadius = RADIUS * h
      const radius = baseRadius * s.zoom
      const cx = w / 2 + shiftX * w
      const cy = h / 2

      // `brand`: "Store accent" is the Home card's palette exactly (deep accent land in dark).
      // Read again only when the look changes: it calls getComputedStyle three times, which on
      // every frame forced a style recalculation each frame.
      if (live.look !== paletteLook) {
        paletteLook = live.look
        palette = readPalette(dark, live.look, true)
      }
      const overlayPalette = {
        marker: palette.marker,
        arc: palette.arc,
        newest: palette.arcNewest,
      }

      const arcsOn = live.layers.arcs
      if (arcsRef.current !== shownArcs || arcsOn !== shownArcsOn) {
        shownArcs = arcsRef.current
        shownArcsOn = arcsOn
        renderer.setPoints(
          0,
          arcsOn ? buildArcPoints(shownArcs, overlayPalette) : new Float32Array(),
        )
      }
      const newestId = markersRef.current.find((m) => m.isNewest)?.id ?? null
      if (newestId !== lastNewestId) {
        lastNewestId = newestId
        revealStartedAt = now
      }
      const reveal = reducedMotion ? 1 : Math.min(1, (now - revealStartedAt) / REVEAL_MS)
      const pulse = reducedMotion ? 1 : 0.55 + 0.45 * Math.abs(Math.sin((now / PULSE_MS) * Math.PI))
      renderer.setPoints(
        1,
        buildMarkerPoints(
          markersRef.current,
          overlayPalette,
          pulse,
          reveal,
          live.data.highlightBigOrders,
        ),
      )

      const m = rotation(s.phi, s.theta)
      const radiusDevicePx = radius * dpr
      const dotSize = DOT_SIZES[live.look.dotSize]
      // From the zoom-1 size, so zooming spreads the same dots apart instead of reshuffling them.
      const dotSamples = pickSpriteDotSamples(baseRadius, dotSize.spacing)
      const subsolar = live.data.dayNightShadow ? subsolarPoint(new Date()) : null
      const sun = subsolar ? toVector(subsolar.lat, subsolar.lng) : null

      // Dashed borders replace the shader's own border line (coastlines are unaffected either
      // way); the "Country borders" layer toggle still gates both.
      const dashedBorders = live.layers.borders && live.look.borderStyle === 'dotted'
      if (dashedBorders) {
        loadBorderPointsIfNeeded()
        const colorKey = palette.borderDot.join(',')
        if (borderPoints && (!borderPointsUploaded || colorKey !== uploadedBorderColorKey)) {
          borderPointsUploaded = true
          uploadedBorderColorKey = colorKey
          renderer.setPoints(2, buildBorderStrokePoints(borderPoints, palette.borderDot))
        }
      } else if (borderPointsUploaded) {
        borderPointsUploaded = false
        uploadedBorderColorKey = null
        renderer.setPoints(2, new Float32Array())
      }

      renderer.draw({
        cx: cx * dpr,
        cy: cy * dpr,
        radius: radiusDevicePx,
        rotation: m,
        pointScale: (radius / Math.max(1, s.zoom)) * dpr,
        dark,
        base: palette.base,
        ocean: palette.ocean,
        glow: palette.glow,
        line: palette.line ?? undefined,
        layers: { ...live.layers, borders: live.layers.borders && !dashedBorders },
        style: live.look.style,
        dotRows: 0,
        dotRadiusPx: 0,
        spriteDots: {
          samples: dotSamples,
          radiusPx: spriteDotRadiusPx(dotSamples, radiusDevicePx, dotSize.fill, 0.6 * dpr),
          diffuse: DOT_DIFFUSE,
          color: palette.landDot,
        },
        sun,
        dashPeriodPx: DASH_PERIOD_CSS_PX * dpr,
      })

      if (
        live.motion.rememberZoom &&
        now - lastZoomSaveAt > ZOOM_SAVE_INTERVAL_MS &&
        Math.abs(s.zoomTarget - lastSavedZoom) > 1e-3
      ) {
        lastZoomSaveAt = now
        lastSavedZoom = s.zoomTarget
        saveLastZoom(s.zoomTarget)
      }

      positionOverlay(container, markersRef.current, activeIdRef.current, (marker) => {
        const [x, y, z] = rotate(m, markerVector(marker))
        const sx = cx + x * radius
        const sy = cy - y * radius
        const inView = sx > -8 && sx < w + 8 && sy > -8 && sy < h + 8
        return { x: sx, y: sy, visible: inView && (z >= 0 || x * x + y * y > 1) }
      })
      rafId = shouldRun() ? requestAnimationFrame(tick) : 0
    }
    rafId = requestAnimationFrame(tick)
    // A hidden tab, or a globe scrolled out of view, draws nothing (no GPU or battery use, no
    // frames taken from scrolling the page) and picks up again when shown.
    const handleVisibility = () => {
      cancelAnimationFrame(rafId)
      rafId = shouldRun() ? requestAnimationFrame(tick) : 0
    }
    document.addEventListener('visibilitychange', handleVisibility)
    const viewObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true
      handleVisibility()
    })
    viewObserver.observe(container)
    const detach = attachControls(canvas, s, reducedMotion)

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', handleVisibility)
      viewObserver.disconnect()
      detach()
      renderer.destroy()
    }
    // Re-run on theme/focus changes; markers/arcs/settings update through the refs above so
    // drag state and the reveal/pulse animation are not interrupted by every poll or setting
    // change, and no setting ever rebuilds the WebGL context.
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
  settingsRef.current = settings ?? defaultGlobeSettings(reducedMotion)
  const settingsButton =
    settings && onSettingsChange && onSettingsReset ? (
      <GlobeSettingsPanel
        settings={settings}
        dark={dark}
        onChange={onSettingsChange}
        onReset={onSettingsReset}
      />
    ) : undefined

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
        settingsButton={settingsButton}
      />
    </div>
  )
}
