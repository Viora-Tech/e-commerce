import { describe, expect, it } from 'vitest'
import { buildBorderDotPoints, decodeBorderPoints, encodeBorderPoints } from './border-points'

describe('encodeBorderPoints / decodeBorderPoints', () => {
  it('round-trips points to 0.01° precision', () => {
    const points = [
      { lat: 28.61, lng: 77.21 },
      { lat: -33.87, lng: 151.21 },
      { lat: 0, lng: 0 },
    ]
    expect(decodeBorderPoints(encodeBorderPoints(points))).toEqual(points)
  })

  it('rounds to the nearest 0.01°', () => {
    const decoded = decodeBorderPoints(encodeBorderPoints([{ lat: 12.345, lng: 6.789 }]))
    expect(decoded).toEqual([{ lat: 12.35, lng: 6.79 }])
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
      { lat: 10, lng: 20 },
      { lat: 30, lng: 40 },
    ])
    // Claims 2 points but the buffer only has room for 1.
    const truncated = full.slice(0, 4 + 4)
    expect(decodeBorderPoints(truncated)).toEqual([{ lat: 10, lng: 20 }])
  })
})

describe('buildBorderDotPoints', () => {
  const points = Array.from({ length: 10 }, (_, i) => ({ lat: i, lng: 0 }))
  const color: [number, number, number] = [0.5, 0.5, 0.5]

  it('keeps every point at stride 1', () => {
    expect(buildBorderDotPoints(points, 1, color).length / 7).toBe(10)
  })

  it('skips (n-1) out of every n points at stride n', () => {
    expect(buildBorderDotPoints(points, 2, color).length / 7).toBe(5)
    expect(buildBorderDotPoints(points, 5, color).length / 7).toBe(2)
  })

  it('puts each dot on the unit sphere, with the given size and colour', () => {
    const dots = buildBorderDotPoints(points, 4, color)
    for (let i = 0; i < dots.length; i += 7) {
      const [x = 0, y = 0, z = 0] = dots.subarray(i, i + 3)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
      expect([...dots.slice(i + 4, i + 7)]).toEqual(color)
    }
  })

  it('never divides by zero or throws for an empty list', () => {
    expect(buildBorderDotPoints([], 6, color)).toHaveLength(0)
  })
})
