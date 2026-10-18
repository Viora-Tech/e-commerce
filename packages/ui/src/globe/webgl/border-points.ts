import type { Rgb } from './globe-renderer'
import { toVector } from './globe-renderer'

export type BorderPoint = { lat: number; lng: number; arc: number }

/** A border dash point's diameter as a share of the radius: small, so consecutive points (a
 * few km apart) merge into a continuous stroke rather than reading as separate dots. */
const BORDER_POINT_SIZE_SHARE = 0.0085

/** For tests, and to keep the format's write side in one place even though the real file is
 * written by `scripts/globe/make-globe-borders.py`. `arc` is radians along the point's run. */
export function encodeBorderPoints(points: BorderPoint[]): ArrayBuffer {
  const buffer = new ArrayBuffer(4 + points.length * 6)
  const view = new DataView(buffer)
  view.setUint32(0, points.length, true)
  points.forEach((p, i) => {
    const offset = 4 + i * 6
    view.setInt16(offset, Math.round(p.lat * 100), true)
    view.setInt16(offset + 2, Math.round(p.lng * 100), true)
    view.setUint16(offset + 4, Math.max(0, Math.min(65_535, Math.round(p.arc * 10_000))), true)
  })
  return buffer
}

/** Decodes a `borders.bin` buffer: a `uint32` point count, then that many `(int16 lat100, int16
 * lng100, uint16 arc10k)` triples. Returns an empty array for anything too short to hold even
 * the count, rather than throwing — a truncated or missing fetch just means no dashes. */
export function decodeBorderPoints(buffer: ArrayBuffer): BorderPoint[] {
  if (buffer.byteLength < 4) return []
  const view = new DataView(buffer)
  const count = view.getUint32(0, true)
  const available = Math.floor((buffer.byteLength - 4) / 6)
  const n = Math.min(count, available)
  const points: BorderPoint[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const offset = 4 + i * 6
    points[i] = {
      lat: view.getInt16(offset, true) / 100,
      lng: view.getInt16(offset + 2, true) / 100,
      arc: view.getUint16(offset + 4, true) / 10_000,
    }
  }
  return points
}

/** All of `borders.bin`'s points as `x, y, z, size, r, g, b, arc` sprites for
 * `GlobeRenderer.setPoints` (the shader discards most of them per-frame to draw the dash
 * pattern; see `border-dash.ts` and `globe-renderer.ts`'s border-stroke draw call). */
export function buildBorderStrokePoints(points: BorderPoint[], color: Rgb): Float32Array {
  const out = new Float32Array(points.length * 8)
  points.forEach((p, i) => {
    const [x, y, z] = toVector(p.lat, p.lng)
    out.set([x, y, z, BORDER_POINT_SIZE_SHARE, ...color, p.arc], i * 8)
  })
  return out
}
