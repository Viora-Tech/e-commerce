import { describe, expect, it } from 'vitest'
import { displayThemeName } from './customize-theme-name'

describe('displayThemeName', () => {
  it.each([
    ['ZERO DRIFT (imported)', 'Zero Drift (imported)'],
    ['ZERO DRIFT', 'Zero Drift'],
    ['(DAWN) copy', '(Dawn) copy'],
    ['Zero Drift', 'Zero Drift'],
    ['Copy of Waimers', 'Copy of Waimers'],
    ['GST theme', 'GST theme'],
    ['Store UI KIT', 'Store UI KIT'],
    ['MOUSE PADS', 'Mouse Pads'],
    ['dawn', 'dawn'],
  ])('shows %j as %j', (name, shown) => {
    expect(displayThemeName(name)).toBe(shown)
  })
})
