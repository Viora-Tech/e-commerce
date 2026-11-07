import { describe, expect, it } from 'vitest'
import { LiquidSectionPlacementSchema } from './fields'

const section = {
  id: 'sections--1__header',
  type: 'header',
  settings: {},
  location: 'header-group',
  index: 0,
}

describe('LiquidSectionPlacementSchema', () => {
  it('keeps what the engine reads from a block', () => {
    const block = {
      id: 'tabs',
      type: 'tabs',
      static: true,
      disabled: true,
      settings: {},
      blocks: [{ id: 'one', type: 'tab', settings: {} }],
    }
    const parsed = LiquidSectionPlacementSchema.parse({ ...section, blocks: [block] })
    expect(parsed.blocks[0]).toEqual(block)
  })

  it('stops reading blocks nested too deep', () => {
    let blocks: unknown[] = []
    for (let i = 0; i < 40; i++) blocks = [{ id: 'b', type: 'group', settings: {}, blocks }]
    const parsed = LiquidSectionPlacementSchema.parse({ ...section, blocks })
    expect(JSON.stringify(parsed).match(/"group"/g)?.length).toBeLessThan(40)
  })
})
