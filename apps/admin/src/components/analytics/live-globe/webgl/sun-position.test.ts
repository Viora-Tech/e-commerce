import { describe, expect, it } from 'vitest'
import { subsolarPoint } from './sun-position'

describe('subsolarPoint', () => {
  it('sits over the Tropic of Cancer near the June solstice', () => {
    const { lat } = subsolarPoint(new Date('2026-06-21T12:00:00Z'))
    expect(lat).toBeGreaterThan(23)
  })

  it('sits over the Tropic of Capricorn near the December solstice', () => {
    const { lat } = subsolarPoint(new Date('2026-12-21T12:00:00Z'))
    expect(lat).toBeLessThan(-23)
  })

  it('is near the equator at the equinoxes', () => {
    expect(Math.abs(subsolarPoint(new Date('2026-03-20T12:00:00Z')).lat)).toBeLessThan(1.5)
    expect(Math.abs(subsolarPoint(new Date('2026-09-23T12:00:00Z')).lat)).toBeLessThan(1.5)
  })

  it('sits near longitude 0 at UTC noon', () => {
    const { lng } = subsolarPoint(new Date('2026-01-15T12:00:00Z'))
    expect(Math.abs(lng)).toBeLessThan(1)
  })

  it('sits near the date line at UTC midnight', () => {
    const { lng } = subsolarPoint(new Date('2026-01-15T00:00:00Z'))
    expect(Math.abs(lng)).toBeGreaterThan(179)
  })

  it('moves 15° of longitude west for every hour that passes', () => {
    const a = subsolarPoint(new Date('2026-01-15T06:00:00Z'))
    const b = subsolarPoint(new Date('2026-01-15T09:00:00Z'))
    let delta = a.lng - b.lng
    delta = ((delta + 540) % 360) - 180
    expect(delta).toBeCloseTo(45, 0)
  })

  it('never returns a latitude outside the axial tilt', () => {
    for (let m = 0; m < 12; m++) {
      const { lat } = subsolarPoint(new Date(Date.UTC(2026, m, 15, 12)))
      expect(lat).toBeGreaterThanOrEqual(-23.45)
      expect(lat).toBeLessThanOrEqual(23.45)
    }
  })
})
