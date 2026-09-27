/**
 * Land dots for the WebGL globe, computed on the CPU in double precision. cobe finds each
 * pixel's nearest Fibonacci-sphere point inside its fragment shader in 32-bit floats, which
 * breaks down above ~32k points (dots overlap and smear); here each point is placed once in
 * JavaScript, tested against the land map and uploaded as a plain vertex buffer, so the count
 * is only limited by memory. Several levels of detail let the globe draw more, smaller dots
 * as it zooms in.
 *
 * Land map: Natural Earth 1:50m land (public domain), rasterised to 2048x1024 by
 * `scripts/globe/make-land-map.py` into `public/globe/land-2048.png`.
 */

/** A 1-per-pixel land mask, equirectangular, north up, longitude -180 at the left edge. */
export type LandMask = { width: number; height: number; land: Uint8Array }

const TAU = Math.PI * 2

/**
 * Points on the whole sphere per level (about 30% land). Each level has about 3x the last;
 * the top one spaces dots about one map pixel (0.18 degrees, 20 km) apart, the finest the
 * 2048x1024 map can show.
 */
export const LOD_SAMPLES = [40_000, 120_000, 360_000, 1_080_000] as const

/** Sphere points at a level (clamped to the levels there are). */
export function levelSamples(level: number): number {
  return LOD_SAMPLES[Math.min(Math.max(0, level), LOD_SAMPLES.length - 1)] ?? LOD_SAMPLES[0]
}

/** Dot spacing we aim for on screen, in CSS pixels: about cobe's at its default size. */
const TARGET_SPACING_PX = 5.5

/** Angular distance between neighbouring points of an n-point Fibonacci sphere, in radians. */
export function dotSpacing(samples: number): number {
  return Math.sqrt((4 * Math.PI) / samples)
}

/** The coarsest level whose dots are no more than the target spacing apart at this radius. */
export function pickLevel(radiusCssPx: number): number {
  const level = LOD_SAMPLES.findIndex((n) => dotSpacing(n) * radiusCssPx <= TARGET_SPACING_PX)
  return level === -1 ? LOD_SAMPLES.length - 1 : level
}

export function isLand(mask: LandMask, lat: number, lng: number): boolean {
  const x = Math.min(mask.width - 1, Math.floor(((lng + 180) / 360) * mask.width))
  const y = Math.min(mask.height - 1, Math.floor(((90 - lat) / 180) * mask.height))
  return mask.land[y * mask.width + x] === 1
}

/**
 * Unit-sphere `x, y, z` of every land point of an n-point Fibonacci sphere, packed for a
 * vertex buffer. Axes: y is north, z faces longitude 0, x faces longitude 90 E.
 *
 * Point i sits at height y = 1 - 2(i + 0.5)/n and longitude i golden-angle turns. y only
 * falls as i grows, so the map row is found by walking down one row boundary at a time (no
 * `asin` per point), and sin/cos are only paid for points that turn out to be land.
 */
/**
 * Unit-sphere `x, y, z` of every land dot, packed for a vertex buffer. Axes: y is north,
 * z faces longitude 0, x faces longitude 90 E.
 *
 * Dots sit in rows of latitude, `dotSpacing(samples)` apart, and each row holds as many
 * evenly spaced dots as fit around it (fewer towards the poles), every other row shifted by
 * half a step. That is the neat, hexagon-like pattern of the Shopify/GitHub globes. (A
 * Fibonacci spiral looked like ring-shaped moiré at 3-4 px, and nudging it at random looked
 * like TV static.) `samples` still means "about this many dots on the whole sphere".
 */
export function buildLandDots(mask: LandMask, samples: number): Float32Array {
  const { width, height, land } = mask
  const step = dotSpacing(samples)
  const rows = Math.max(1, Math.round(Math.PI / step))
  const out: number[] = []
  for (let r = 0; r < rows; r++) {
    const lat = Math.PI / 2 - (r + 0.5) * (Math.PI / rows)
    const ring = Math.cos(lat)
    const count = Math.max(1, Math.round((TAU * ring) / step))
    const offset = r % 2 === 0 ? 0 : 0.5
    const y = Math.sin(lat)
    const row = Math.min(height - 1, Math.floor(((Math.PI / 2 - lat) / Math.PI) * height))
    for (let k = 0; k < count; k++) {
      // Share of a full turn east of longitude 0, then shifted so -180 is the map's left edge.
      const turn = (k + offset) / count
      const x = Math.floor(turn * width + width / 2)
      if (land[row * width + (x >= width ? x - width : x)] !== 1) continue
      const lng = turn * TAU
      out.push(ring * Math.sin(lng), y, ring * Math.cos(lng))
    }
  }
  return Float32Array.from(out)
}

/** Decodes the land map PNG (white land on black sea) into a mask. Browser only. */
export async function loadLandMask(src: string): Promise<LandMask> {
  const image = new Image()
  image.src = src
  await image.decode()
  const { width, height } = image
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('2d canvas unavailable')
  context.drawImage(image, 0, 0)
  const rgba = context.getImageData(0, 0, width, height).data
  const land = new Uint8Array(width * height)
  for (let i = 0; i < land.length; i++) land[i] = (rgba[i * 4] ?? 0) > 127 ? 1 : 0
  return { width, height, land }
}

/** Where the land map is served from (`apps/admin/public`). */
const LAND_MAP_SRC = '/globe/land-2048.png'

let mask: LandMask | null = null
let maskLoading: Promise<LandMask> | null = null
const levels = new Map<number, Float32Array>()

/** Loads the land map once per page session; later calls share the same promise. */
export function loadLand(): Promise<LandMask> {
  maskLoading ??= loadLandMask(LAND_MAP_SRC).then((loaded) => {
    mask = loaded
    return loaded
  })
  return maskLoading
}

/** A level's dots, built on first use and kept (theme changes and remounts reuse them); null
 * until the land map has loaded. */
export function landLevel(level: number): Float32Array | null {
  if (!mask) return null
  let dots = levels.get(level)
  if (!dots) {
    dots = buildLandDots(mask, levelSamples(level))
    levels.set(level, dots)
  }
  return dots
}
