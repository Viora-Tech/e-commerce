import type { GlobeArc, GlobeMarker } from '../types'
import { type Rgb, toVector, type Vec3 } from './globe-renderer'

/** cobe's settings from the Home card globe, converted from its 0.8-radius units to a unit
 * sphere: marker lift, arc peak height and arc width (as a share of the radius). */
const MARKER_LIFT = 0.025
const ARC_PEAK = 1.425
const ARC_WIDTH = 0.006875

export type OverlayPalette = { marker: Rgb; arc: Rgb; newest: Rgb }

/** A marker's lifted position on the unit sphere; the overlay buttons are placed from it too. */
export function markerVector(m: { lat: number; lng: number }): Vec3 {
  const [x, y, z] = toVector(m.lat, m.lng)
  const k = 1 + MARKER_LIFT
  return [x * k, y * k, z * k]
}

/**
 * Arcs as `x, y, z, size, r, g, b` point sprites for `GlobeRenderer.setPoints`: cobe's
 * quadratic curve from one lifted marker to the other, bowing out to `ARC_PEAK` over the
 * midpoint, drawn as a chain of dots close enough to read as a line.
 */
export function buildArcPoints(arcs: GlobeArc[], palette: OverlayPalette): Float32Array {
  const out: number[] = []
  for (const arc of arcs) {
    const a = markerVector({ lat: arc.fromLat, lng: arc.fromLng })
    const b = markerVector({ lat: arc.toLat, lng: arc.toLng })
    const mid: Vec3 = [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
    const length = Math.hypot(...mid)
    if (length < 1e-3) continue
    const k = ARC_PEAK / length
    const control: Vec3 = [mid[0] * k, mid[1] * k, mid[2] * k]
    // Half the angle between the ends; longer arcs get more dots so they stay unbroken.
    const chord = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / (1 + MARKER_LIFT)
    const steps = Math.ceil(32 + Math.asin(Math.min(1, chord / 2)) * 520)
    const color = arc.isNewest ? palette.newest : palette.arc
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const [u, v, w] = [(1 - t) ** 2, 2 * (1 - t) * t, t ** 2]
      out.push(
        u * a[0] + v * control[0] + w * b[0],
        u * a[1] + v * control[1] + w * b[1],
        u * a[2] + v * control[2] + w * b[2],
        ARC_WIDTH,
        ...color,
      )
    }
  }
  return new Float32Array(out)
}

/** A big-order glow marker is drawn this much larger than its own marker, at this much of its
 * brightness, so it reads as a soft halo behind it rather than a second solid dot. */
const GLOW_SIZE_SCALE = 2.6
const GLOW_BRIGHTNESS = 0.4

/** What share of the shown markers "Highlight big orders" treats as big enough for the soft
 * glow: the top 10%, at least one when there is any spread in value at all. */
const BIG_ORDER_SHARE = 0.1

/** The value at (and above) which a marker counts as "big": the smallest value among the top
 * `BIG_ORDER_SHARE` of `values`, so exactly that many (rounded, floor 1) qualify. */
function bigOrderThreshold(values: number[]): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY
  const count = Math.max(1, Math.round(values.length * BIG_ORDER_SHARE))
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, sorted.length - count)] ?? Number.POSITIVE_INFINITY
}

/**
 * Markers as point sprites. The newest pulses (`pulse`, 0..1) and grows in on arrival
 * (`reveal`, 0..1); sizes are cobe's (0.045, newest up to 0.09) as a diameter over the radius.
 *
 * With `highlightBigOrders` on, size also scales with `valuePaise` (square-root, so it reads
 * as area rather than diameter) and the top 10% by value get an extra, larger, dimmer point
 * drawn just behind theirs as a soft glow (the point sprite format carries no per-vertex alpha,
 * so the "soft" comes from size and dimness rather than transparency).
 */
export function buildMarkerPoints(
  markers: GlobeMarker[],
  palette: OverlayPalette,
  pulse: number,
  reveal: number,
  highlightBigOrders = false,
): Float32Array {
  const values = markers.map((m) => m.valuePaise ?? 0)
  const maxValue = Math.max(0, ...values)
  const bigThreshold =
    highlightBigOrders && maxValue > 0 ? bigOrderThreshold(values) : Number.POSITIVE_INFINITY

  const out: number[] = []
  for (const m of markers) {
    const value = m.valuePaise ?? 0
    const scale =
      highlightBigOrders && maxValue > 0 ? 0.75 + 0.65 * Math.sqrt(value / maxValue) : 1
    const baseSize = m.isNewest ? 0.09 * (0.6 + 0.4 * pulse) * reveal : 0.045
    const size = baseSize * scale * 1.25
    const color = m.isNewest ? palette.newest : palette.marker
    const point = markerVector(m)
    if (highlightBigOrders && maxValue > 0 && value >= bigThreshold) {
      const glow: Rgb = [color[0] * GLOW_BRIGHTNESS, color[1] * GLOW_BRIGHTNESS, color[2] * GLOW_BRIGHTNESS]
      out.push(...point, size * GLOW_SIZE_SCALE, ...glow)
    }
    out.push(...point, size, ...color)
  }
  return Float32Array.from(out)
}
