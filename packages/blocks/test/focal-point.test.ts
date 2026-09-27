import { describe, expect, it } from 'vitest'
import {
  focalFromPoint,
  focalStyle,
  focalToObjectPosition,
  normaliseFocal,
  nudgeFocal,
} from '../src/focal-point'

describe('focal point mapping', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 }

  it('maps a click on the preview to percentages from the top-left', () => {
    expect(focalFromPoint(rect, 100, 50)).toEqual({ x: 0, y: 0 })
    expect(focalFromPoint(rect, 200, 100)).toEqual({ x: 50, y: 50 })
    expect(focalFromPoint(rect, 300, 150)).toEqual({ x: 100, y: 100 })
    expect(focalFromPoint(rect, 160, 83)).toEqual({ x: 30, y: 33 })
  })

  it('clamps clicks outside the box and rounds to one decimal', () => {
    expect(focalFromPoint(rect, 0, 500)).toEqual({ x: 0, y: 100 })
    expect(focalFromPoint({ left: 0, top: 0, width: 3, height: 3 }, 1, 2)).toEqual({
      x: 33.3,
      y: 66.7,
    })
    expect(focalFromPoint({ left: 0, top: 0, width: 0, height: 0 }, 1, 1)).toEqual({
      x: 50,
      y: 50,
    })
  })

  it('turns a stored point into object-position, centre when missing or broken', () => {
    expect(focalToObjectPosition({ x: 30, y: 60 })).toBe('30% 60%')
    expect(focalToObjectPosition(undefined)).toBe('50% 50%')
    expect(focalToObjectPosition({ x: 'a', y: 1 })).toBe('50% 50%')
    expect(focalToObjectPosition({ x: 140, y: -5 })).toBe('100% 0%')
    expect(normaliseFocal({ x: Number.NaN, y: 1 })).toBeNull()
  })

  it('leaves centred images without an inline style', () => {
    expect(focalStyle(undefined)).toBeUndefined()
    expect(focalStyle({ x: 50, y: 50 })).toBeUndefined()
    expect(focalStyle({ x: 20, y: 80 })).toEqual({ objectPosition: '20% 80%' })
  })

  it('nudges with the arrow keys inside the box', () => {
    expect(nudgeFocal(undefined, 5, 0)).toEqual({ x: 55, y: 50 })
    expect(nudgeFocal({ x: 98, y: 1 }, 5, -5)).toEqual({ x: 100, y: 0 })
  })
})

describe('section links', () => {
  it('opens in a new tab only when the switch is on', async () => {
    const { linkTarget } = await import('../src/link')
    expect(linkTarget({ label: 'Shop', href: '/', newTab: true })).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(linkTarget({ label: 'Shop', href: '/' })).toEqual({})
    expect(linkTarget(undefined)).toEqual({})
  })
})
