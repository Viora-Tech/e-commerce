import { describe, expect, it } from 'vitest'
import { buildBorderStrokePoints, decodeBorderPoints, encodeBorderPoints } from './border-points'

describe('encodeBorderPoints / decodeBorderPoints', () => {
  it('round-trips points to 0.01° / 0.0001 rad precision', () => {
    const points = [
      { lat: 28.61, lng: 77.21, arc: 0 },
      { lat: -33.87, lng: 151.21, arc: 1.2345 },
      { lat: 0, lng: 0, arc: 0.0001 },
    ]
    expect(decodeBorderPoints(encodeBorderPoints(points))).toEqual(points)
  })

  it('rounds lat/lng to the nearest 0.01°', () => {
    const decoded = decodeBorderPoints(encodeBorderPoints([{ lat: 12.345, lng: 6.789, arc: 0 }]))
    expect(decoded).toEqual([{ lat: 12.35, lng: 6.79, arc: 0 }])
  })

  it('clamps arc length to what a uint16 can hold, never wrapping negative', () => {
    const decoded = decodeBorderPoints(encodeBorderPoints([{ lat: 0, lng: 0, arc: 100 }]))
    expect(decoded[0]?.arc).toBeCloseTo(6.5535, 4)
  })

  it('handles an empty file', () => {
    expect(decodeBorderPoints(encodeBorderPoints([]))).toEqual([])
  })

  it('never throws on a buffer too short to hold the count', () => {
    expect(decodeBorderPoints(new ArrayBuffer(0))).toEqual([])
    expect(decodeBorderPoints(new ArrayBuffer(2))).toEqual([])
  })

  it('never throws on a truncated file, and reads as many whole points as it can', () => {
    const full = encodeBorderPoints([
      { lat: 10, lng: 20, arc: 0 },
      { lat: 30, lng: 40, arc: 1 },
    ])
    // Claims 2 points but the buffer only has room for 1 (6 bytes/point + the 4-byte header).
    const truncated = full.slice(0, 4 + 6)
    expect(decodeBorderPoints(truncated)).toEqual([{ lat: 10, lng: 20, arc: 0 }])
  })
})

describe('buildBorderStrokePoints', () => {
  const points = Array.from({ length: 10 }, (_, i) => ({ lat: i, lng: 0, arc: i * 0.001 }))
  const color: [number, number, number] = [0.5, 0.5, 0.5]

  it('keeps every point (the shader, not this function, decides the dash pattern)', () => {
    expect(buildBorderStrokePoints(points, color).length / 8).toBe(10)
  })

  it('puts each point on the unit sphere, with the given size, colour and arc length', () => {
    const dots = buildBorderStrokePoints(points, color)
    for (let i = 0; i < dots.length; i += 8) {
      const [x = 0, y = 0, z = 0] = dots.subarray(i, i + 3)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
      expect([...dots.slice(i + 4, i + 7)]).toEqual(color)
      const expectedArc = points[i / 8]?.arc ?? 0
      expect(dots[i + 7]).toBeCloseTo(expectedArc, 6)
    }
  })

  it('never throws for an empty list', () => {
    expect(buildBorderStrokePoints([], color)).toHaveLength(0)
  })
})
