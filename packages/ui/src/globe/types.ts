import type { ReactNode } from 'react'

/** A pin on the globe. `tooltip` is shown next to it on hover or focus. */
export type GlobeMarker = {
  id: string
  lat: number
  lng: number
  label: string
  isNewest: boolean
  /** City, order number and amount; shown next to the marker on hover or focus. */
  tooltip: ReactNode
  /** The order's total, for "Highlight big orders" (marker size, and a glow on the top 10%).
   * Undefined markers (e.g. none carry it) are treated as zero, so sizing just falls back to
   * the flat default. */
  valuePaise?: number
}

export type GlobeArc = {
  id: string
  fromLat: number
  fromLng: number
  toLat: number
  toLng: number
  isNewest: boolean
}
