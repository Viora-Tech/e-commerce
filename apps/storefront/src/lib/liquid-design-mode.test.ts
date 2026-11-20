import { describe, expect, it } from 'vitest'
import { planDesignUpdate } from './liquid-design-mode'

const section = (id: string, heading = 'Hi') => ({
  id,
  placement: {
    id,
    type: 'hero',
    settings: { heading },
    blocks: [],
    location: 'template',
    index: 0,
  },
})

describe('planDesignUpdate', () => {
  it('renders every section on the first state: the page holds the saved theme', () => {
    const plan = planDesignUpdate(new Map(), null, {
      zones: { template: [section('a'), section('b')] },
      selected: { sectionId: 'a', blockId: null },
    })
    expect(plan.render.map((s) => s.id)).toEqual(['a', 'b'])
    expect(plan.remove).toEqual([])
    expect(plan.select).toEqual({ sectionId: 'a', blockId: null })
    expect(plan.deselect).toBeNull()
  })

  it('renders only what changed, removes what is gone, and moves the selection', () => {
    const first = planDesignUpdate(new Map(), null, {
      zones: { template: [section('a'), section('b'), section('c')] },
      selected: null,
    })
    const plan = planDesignUpdate(
      first.known,
      { sectionId: 'a', blockId: null },
      {
        zones: { template: [section('b', 'New'), section('a')] },
        selected: { sectionId: 'b', blockId: 'slide-1' },
      },
    )
    expect(plan.render.map((s) => s.id)).toEqual(['b'])
    expect(plan.remove).toEqual(['c'])
    expect(plan.deselect).toEqual({ sectionId: 'a', blockId: null })
    expect(plan.select).toEqual({ sectionId: 'b', blockId: 'slide-1' })
  })

  it('fires no selection events when the selection stays', () => {
    const sel = { sectionId: 'a', blockId: null }
    const first = planDesignUpdate(new Map(), null, {
      zones: { template: [section('a')] },
      selected: sel,
    })
    const plan = planDesignUpdate(first.known, sel, {
      zones: { template: [section('a')] },
      selected: { ...sel },
    })
    expect(plan.render).toEqual([])
    expect(plan.select).toBeNull()
    expect(plan.deselect).toBeNull()
  })
})
