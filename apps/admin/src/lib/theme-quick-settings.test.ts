import { describe, expect, it } from 'vitest'
import {
  CORNER_RADII,
  cornerStyleOf,
  SIZE_SCALES,
  type SizeScale,
  sizeScaleOf,
  toHex,
} from './theme-quick-settings'

describe('sizeScaleOf', () => {
  it('reads back each choice it sets', () => {
    for (const id of ['s', 'm', 'l'] as SizeScale[]) expect(sizeScaleOf(SIZE_SCALES[id])).toBe(id)
  })

  it('picks the nearest choice for the presets in between', () => {
    expect(sizeScaleOf({ headingScale: 0.95 })).toBe('m')
    expect(sizeScaleOf({ headingScale: 1.1 })).toBe('l')
    expect(sizeScaleOf({ headingScale: 0.5 })).toBe('s')
  })
})

describe('cornerStyleOf', () => {
  it('reads back each choice it sets', () => {
    for (const [id, px] of Object.entries(CORNER_RADII)) expect(cornerStyleOf(px)).toBe(id)
  })

  it('puts the presets on the nearest choice', () => {
    expect(cornerStyleOf(4)).toBe('soft')
    expect(cornerStyleOf(40)).toBe('round')
    expect(cornerStyleOf(2)).toBe('square')
  })
})

describe('toHex', () => {
  it('takes six or three digits, with or without #', () => {
    expect(toHex('1f1f21')).toBe('#1F1F21')
    expect(toHex(' #3f72dc ')).toBe('#3F72DC')
    expect(toHex('#abc')).toBe('#AABBCC')
  })

  it('refuses anything that is not a colour yet', () => {
    expect(toHex('#12')).toBeNull()
    expect(toHex('blue')).toBeNull()
    expect(toHex('#1234567')).toBeNull()
  })
})
