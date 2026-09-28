import { describe, expect, it } from 'vitest'
import { anglesFor, rotate, rotation, toVector } from './globe-renderer'
import { buildArcPoints, buildMarkerPoints } from './overlay-points'

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

// Every point sprite (arcs, markers, border strokes) is 8 floats: x, y, z, size, r, g, b, arc
// — the trailing "arc" (a border stroke's distance along its run) is always 0 for arcs/markers.
const STRIDE = 8

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
    const count = points.length / STRIDE
    expect(count).toBeGreaterThan(32)
    const radiusAt = (i: number) => Math.hypot(...points.subarray(i * STRIDE, i * STRIDE + 3))
    expect(radiusAt(0)).toBeCloseTo(1.025, 5)
    expect(radiusAt(count - 1)).toBeCloseTo(1.025, 5)
    expect(radiusAt(Math.floor(count / 2))).toBeGreaterThan(1.025)
    expect([...points.slice(4, 7)]).toEqual(palette.arc)
    expect(points[7]).toBe(0)
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
    expect(points[STRIDE + 3]).toBeCloseTo(0.09 * 0.5 * 1.25, 6)
    expect([...points.slice(STRIDE + 4, STRIDE + 7)]).toEqual(palette.newest)
  })

  it('with highlightBigOrders off, ignores order value entirely (unchanged from before)', () => {
    const marker = { lat: 0, lng: 0, label: '', tooltip: null, isNewest: false }
    const points = buildMarkerPoints(
      [
        { ...marker, id: 'small', valuePaise: 100 },
        { ...marker, id: 'huge', valuePaise: 100_000_000 },
      ],
      palette,
      1,
      1,
      false,
    )
    expect(points).toHaveLength(2 * STRIDE)
    expect(points[3]).toBeCloseTo(points[STRIDE + 3] as number, 6)
  })

  it('with highlightBigOrders on, scales marker size with order value', () => {
    const marker = { lat: 0, lng: 0, label: '', tooltip: null, isNewest: false }
    const points = buildMarkerPoints(
      [
        { ...marker, id: 'small', valuePaise: 100 },
        { ...marker, id: 'huge', valuePaise: 100_000_000 },
      ],
      palette,
      1,
      1,
      true,
    )
    // The huge order gets its own glow point (drawn first) plus its marker: 3 points in all.
    expect(points).toHaveLength(3 * STRIDE)
    const smallSize = points[3] as number
    const glowSize = points[STRIDE + 3] as number
    const hugeSize = points[2 * STRIDE + 3] as number
    expect(hugeSize).toBeGreaterThan(smallSize)
    expect(glowSize).toBeGreaterThan(hugeSize)
  })

  it('gives only the top 10% by value a glow point, dimmer than its marker', () => {
    const marker = { lat: 0, lng: 0, label: '', tooltip: null, isNewest: false }
    const markers = Array.from({ length: 10 }, (_, i) => ({
      ...marker,
      id: `m${i}`,
      valuePaise: (i + 1) * 1000,
    }))
    const points = buildMarkerPoints(markers, palette, 1, 1, true)
    // 10 markers, only the biggest (the top 10%) gets an extra glow point ahead of it.
    expect(points.length / STRIDE).toBe(11)
    const glowColor = points.slice(0, 3) as unknown as [number, number, number]
    const markerColor = palette.marker
    // palette.marker is [0, 1, 0]; the glow point dims its green channel.
    expect(glowColor[1]).toBeLessThan(markerColor[1])
  })
})
