import { describe, expect, it } from 'vitest'
import { fitZoom, stepZoom, zoomLabel } from './customize-zoom'

describe('fitZoom', () => {
  it('scales a wide device down to the space, in whole percents, never above 100 %', () => {
    expect(fitZoom(1440, 864)).toBe(0.6)
    expect(fitZoom(1440, 1000)).toBe(0.69)
    expect(fitZoom(390, 900)).toBe(1)
  })

  it('stops at 25 % and treats an unmeasured space as 100 %', () => {
    expect(fitZoom(1440, 100)).toBe(0.25)
    expect(fitZoom(1440, 0)).toBe(1)
  })
})

describe('stepZoom', () => {
  it('moves to the next fixed level, from a level or from between levels', () => {
    expect(stepZoom(1, 1)).toBe(1.25)
    expect(stepZoom(1, -1)).toBe(0.75)
    expect(stepZoom(0.6, 1)).toBe(0.75)
    expect(stepZoom(0.6, -1)).toBe(0.5)
  })

  it('stays inside 25–200 %', () => {
    expect(stepZoom(2, 1)).toBe(2)
    expect(stepZoom(0.25, -1)).toBe(0.25)
  })
})

it('labels a zoom like the Figma readout', () => {
  expect(zoomLabel(0.6)).toBe('60 %')
})
