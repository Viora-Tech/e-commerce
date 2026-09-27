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
