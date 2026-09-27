import { describe, expect, it } from 'vitest'
import { anglesFor, rotate, rotation, toVector } from './globe-renderer'
import {
  buildLandDots,
  dotSpacing,
  isLand,
  type LandMask,
  LOD_SAMPLES,
  levelSamples,
  pickLevel,
} from './land-dots'
import { buildArcPoints, buildMarkerPoints } from './overlay-points'

/** A 360x180 mask (one pixel a degree) that is land only east of 0 and north of the equator. */
function quadrantMask(): LandMask {
  const width = 360
  const height = 180
  const land = new Uint8Array(width * height)
  for (let y = 0; y < 90; y++) for (let x = 180; x < 360; x++) land[y * width + x] = 1
  return { width, height, land }
}

describe('isLand', () => {
  it('reads the pixel under a lat/lng, including the map edges', () => {
    const mask = quadrantMask()
    expect(isLand(mask, 45, 90)).toBe(true)
    expect(isLand(mask, -45, 90)).toBe(false)
    expect(isLand(mask, 45, -90)).toBe(false)
    expect(isLand(mask, 90, 180)).toBe(true)
    expect(isLand(mask, -90, -180)).toBe(false)
  })
})

describe('buildLandDots', () => {
  it('keeps only land points, as unit vectors in the north-east quadrant', () => {
    const dots = buildLandDots(quadrantMask(), 20_000)
    const count = dots.length / 3
    // A quarter of the sphere is land in this mask.
    expect(count).toBeGreaterThan(4_900)
    expect(count).toBeLessThan(5_100)
    for (let i = 0; i < dots.length; i += 3) {
      const [x = 0, y = 0, z = 0] = dots.subarray(i, i + 3)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
      expect(y).toBeGreaterThanOrEqual(0)
      // East longitudes (0..180) have x = cos(lat) sin(lng) >= 0.
      expect(x).toBeGreaterThanOrEqual(-1e-6)
    }
  })

  it('lays dots out in even rows of latitude (no spiral moiré, no random static)', () => {
    const dots = buildLandDots(quadrantMask(), 20_000)
    const heights = new Set<string>()
    for (let i = 1; i < dots.length; i += 3) heights.add((dots[i] ?? 0).toFixed(6))
    // About half the rows are in the northern (land) half; every dot sits on one of them.
    const rows = Math.round(Math.PI / dotSpacing(20_000))
    expect(heights.size).toBeLessThanOrEqual(Math.ceil(rows / 2))
    expect(heights.size).toBeGreaterThan(rows / 2 - 2)
  })

  it('scales past cobe’s 32k ceiling without losing precision', () => {
    const top = levelSamples(LOD_SAMPLES.length - 1)
    const dots = buildLandDots(quadrantMask(), top)
    expect(dots.length / 3).toBeGreaterThan(top * 0.24)
    // Neighbouring points stay distinct: no two consecutive dots collapse onto one spot.
    for (let i = 3; i < 3000; i += 3) {
      const [x = 0, y = 0, z = 0, px = 0, py = 0, pz = 0] = dots.subarray(i - 3, i + 3)
      const d = Math.hypot(x - px, y - py, z - pz)
      expect(d).toBeGreaterThan(1e-6)
    }
  })
})

describe('pickLevel', () => {
  it('uses more, smaller dots as the globe grows on screen', () => {
    const small = pickLevel(150)
    const large = pickLevel(1_200)
    expect(small).toBe(0)
    expect(large).toBeGreaterThan(small)
    expect(pickLevel(100_000)).toBe(LOD_SAMPLES.length - 1)
  })

  it('keeps the chosen level’s spacing near the target where it can', () => {
    for (const radius of [300, 600, 900]) {
      const level = pickLevel(radius)
      expect(dotSpacing(levelSamples(level)) * radius).toBeLessThanOrEqual(5.5)
    }
  })
})

describe('rotation', () => {
  it('turns the focus point to face the viewer', () => {
    const [phi, theta] = anglesFor(22.35, 78.6)
    const [x, y, z] = rotate(rotation(phi, theta), toVector(22.35, 78.6))
    expect(x).toBeCloseTo(0, 9)
    expect(y).toBeCloseTo(0, 9)
    expect(z).toBeCloseTo(1, 9)
  })

  it('puts the east on the right and the north on top', () => {
    const [phi, theta] = anglesFor(0, 0)
    const m = rotation(phi, theta)
    expect(rotate(m, toVector(0, 30))[0]).toBeGreaterThan(0)
    expect(rotate(m, toVector(30, 0))[1]).toBeGreaterThan(0)
  })
})

describe('overlay points', () => {
  const palette = {
    marker: [0, 1, 0] as [number, number, number],
    arc: [0, 0, 1] as [number, number, number],
    newest: [1, 0, 0] as [number, number, number],
  }

  it('draws an arc as a dotted curve that starts and ends at its markers and bows outwards', () => {
    const points = buildArcPoints(
      [{ id: 'a', fromLat: 19, fromLng: 73, toLat: 28.6, toLng: 77.2, isNewest: false }],
      palette,
    )
    const count = points.length / 7
    expect(count).toBeGreaterThan(32)
    const radiusAt = (i: number) => Math.hypot(...points.subarray(i * 7, i * 7 + 3))
    expect(radiusAt(0)).toBeCloseTo(1.025, 5)
    expect(radiusAt(count - 1)).toBeCloseTo(1.025, 5)
    expect(radiusAt(Math.floor(count / 2))).toBeGreaterThan(1.025)
    expect([...points.slice(4, 7)]).toEqual(palette.arc)
  })

  it('pulses and reveals only the newest marker', () => {
    const marker = { lat: 0, lng: 0, label: '', tooltip: null }
    const points = buildMarkerPoints(
      [
        { ...marker, id: 'old', isNewest: false },
        { ...marker, id: 'new', isNewest: true },
      ],
      palette,
      1,
      0.5,
    )
    expect(points[3]).toBeCloseTo(0.045 * 1.25, 6)
    expect(points[7 + 3]).toBeCloseTo(0.09 * 0.5 * 1.25, 6)
    expect([...points.slice(11, 14)]).toEqual(palette.newest)
  })
})
