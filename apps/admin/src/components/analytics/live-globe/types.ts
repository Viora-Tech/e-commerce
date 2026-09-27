import type { ReactNode } from 'react'

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

/** Props both globes take (cobe on the Home card, our WebGL globe on the Live view). */
export type GlobeCanvasProps = {
  markers: GlobeMarker[]
  arcs: GlobeArc[]
  reducedMotion: boolean
  dark: boolean
  focus: { lat: number; lng: number }
  activeId: string | null
  onActiveChange: (id: string | null) => void
  /**
   * Sizes the drawing area. Square by default (Home card); the Live view hero passes a wide
   * box so the globe, which is fitted to the height, can grow sideways when zoomed.
   */
  className?: string
  /**
   * Moves the globe's centre right by this share of the canvas width (0 = centred). The Live
   * view uses it to sit the globe on the right while the stats float over the left.
   */
  shiftX?: number
}
