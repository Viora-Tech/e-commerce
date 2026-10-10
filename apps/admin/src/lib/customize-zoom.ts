/**
 * SOURCE OF TRUTH KEYWORDS: canvas zoom, DEVICE_PX, ZOOM_STEPS, fitZoom, CanvasZoomContext
 * WHAT:  The Customize canvas's design widths and zoom: the page is laid out at the device's
 *        real width (1440 / 768 / 390 px) and scaled to Fit, or to a fixed 25–200 %.
 * WHY:   A desktop preview squeezed into the space between the panels showed the tablet layout;
 *        drawing it at 1440 px and scaling keeps what the merchant sees true to the store.
 * WHERE: `customize-layout.tsx` scales the frame, `customize-top-bar.tsx` shows "1440 PX / 60 %",
 *        `preview-frame.tsx` hands the zoom to the canvas (`--canvas-zoom`) so the toolbar,
 *        "+" line and outlines keep their size.
 */

import { createContext, useContext } from 'react'
import type { PreviewDevice } from '@/components/themes/theme-preview'

/** The width each preview device is laid out at, in CSS pixels. */
export const DEVICE_PX: Record<PreviewDevice, number> = { desktop: 1440, tablet: 768, mobile: 390 }

/** The fixed zoom levels, smallest first. */
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2

/** "fit" follows the space available; a number is a fixed zoom. */
export type CanvasZoom = 'fit' | number

/** The zoom that fits `devicePx` into `availablePx`: never above 100 %, whole percents. */
export function fitZoom(devicePx: number, availablePx: number): number {
  if (devicePx <= 0 || availablePx <= 0) return 1
  return Math.max(MIN_ZOOM, Math.min(1, Math.floor((availablePx / devicePx) * 100) / 100))
}

/** The next fixed level in or out from `current` (which may sit between levels, like Fit's). */
export function stepZoom(current: number, direction: -1 | 1): number {
  if (direction === 1) return ZOOM_STEPS.find((z) => z > current + 0.001) ?? MAX_ZOOM
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001) ?? MIN_ZOOM
}

/** "60 %" */
export const zoomLabel = (zoom: number) => `${Math.round(zoom * 100)} %`

/** The canvas's zoom as a CSS custom property on the preview's root (unitless). */
export const CANVAS_ZOOM_VAR = '--canvas-zoom'

/**
 * Editor chrome drawn inside the canvas (toolbar, "+" line) undoes the canvas zoom with CSS
 * `zoom`, so it stays the same size on screen at any zoom, and its hit area with it.
 */
export const UNZOOMED = '[zoom:calc(1/var(--canvas-zoom,1))]'

type CanvasZoomState = {
  /** The zoom the canvas is drawn at now (Fit resolved to a number). */
  zoom: number
  mode: CanvasZoom
  /** What Fit comes to in the space there is now. */
  fit: number
  /** The width the page is laid out at. */
  devicePx: number
  setMode: (mode: CanvasZoom) => void
}

/** The canvas's zoom and its control. `CustomizeLayout` provides it; 100 % outside Customize. */
export const CanvasZoomContext = createContext<CanvasZoomState>({
  zoom: 1,
  mode: 'fit',
  fit: 1,
  devicePx: DEVICE_PX.desktop,
  setMode: () => {},
})

export const useCanvasZoom = () => useContext(CanvasZoomContext)
