import { describe, expect, it } from 'vitest'
import { FOOTER_ZONE, HEADER_ZONE, MAIN_ZONE } from './customize-doc'
import {
  clampInsertIndex,
  edgeNear,
  groupForZone,
  insertActions,
  insertAt,
  renamedProps,
  sectionBlocks,
  sectionName,
  targetForEdge,
  withBlockAdded,
  withBlockRemoved,
} from './customize-insert'

describe('insert at position', () => {
  it('inserts before, between and after existing sections', () => {
    const list = ['hero', 'grid', 'text']
    expect(insertAt(list, 0, 'new')).toEqual(['new', 'hero', 'grid', 'text'])
    expect(insertAt(list, 1, 'new')).toEqual(['hero', 'new', 'grid', 'text'])
    expect(insertAt(list, 2, 'new')).toEqual(['hero', 'grid', 'new', 'text'])
    expect(insertAt(list, 3, 'new')).toEqual(['hero', 'grid', 'text', 'new'])
  })

  it('clamps stale or odd indexes into the list', () => {
    expect(clampInsertIndex(-2, 3)).toBe(0)
    expect(clampInsertIndex(9, 3)).toBe(3)
    expect(clampInsertIndex(1.7, 3)).toBe(1)
    expect(clampInsertIndex(Number.NaN, 3)).toBe(3)
    expect(clampInsertIndex(0, 0)).toBe(0)
    expect(insertAt([], 5, 'only')).toEqual(['only'])
  })

  it('builds the insert and select actions for the exact spot', () => {
    expect(insertActions({ zone: MAIN_ZONE, index: 1 }, 'Faq', 3)).toEqual([
      { type: 'insert', componentType: 'Faq', destinationIndex: 1, destinationZone: MAIN_ZONE },
      { type: 'setUi', ui: { itemSelector: { index: 1, zone: MAIN_ZONE } } },
    ])
    const [insert] = insertActions({ zone: HEADER_ZONE, index: 10 }, 'AnnouncementBar', 1)
    expect(insert).toMatchObject({ destinationIndex: 1, destinationZone: HEADER_ZONE })
  })

  it('knows which group a zone belongs to', () => {
    expect(groupForZone(HEADER_ZONE)).toBe('header')
    expect(groupForZone(FOOTER_ZONE)).toBe('footer')
    expect(groupForZone(MAIN_ZONE)).toBeNull()
  })
})

describe('rename', () => {
  const section = { type: 'Hero', props: { id: 'a' } }

  it('shows the custom name, else the type label', () => {
    expect(sectionName(section, 'Hero')).toBe('Hero')
    expect(sectionName({ ...section, props: { id: 'a', _name: ' Diwali banner ' } }, 'Hero')).toBe(
      'Diwali banner',
    )
  })

  it('stores a trimmed name and clears it when blank or unchanged', () => {
    expect(renamedProps(section.props, '  Sale  ', 'Hero')).toEqual({ id: 'a', _name: 'Sale' })
    expect(renamedProps({ id: 'a', _name: 'Sale' }, '', 'Hero')).toEqual({ id: 'a' })
    expect(renamedProps({ id: 'a', _name: 'Sale' }, 'Hero', 'Hero')).toEqual({ id: 'a' })
  })
})

describe('blocks', () => {
  const fields = {
    heading: { type: 'text' },
    slides: {
      type: 'array',
      label: 'Slides',
      max: 2,
      defaultItemProps: { heading: 'New slide' },
      getItemSummary: (item: Record<string, unknown>) => String(item.heading ?? ''),
    },
  }

  it('lists array items as blocks, with add and remove limits', () => {
    const props = { heading: 'x', slides: [{ heading: 'One' }, { heading: '' }] }
    const [list] = sectionBlocks(props, fields, (i) => `Item ${i + 1}`)
    expect(list).toEqual({
      key: 'slides',
      label: 'Slides',
      blocks: [
        { key: 'slides', index: 0, title: 'One' },
        { key: 'slides', index: 1, title: 'Item 2' },
      ],
      canAdd: false,
      canRemove: true,
    })
    expect(sectionBlocks({}, { heading: { type: 'text' } }, String)).toEqual([])
  })

  it('adds a block from the field defaults and removes one by index', () => {
    const added = withBlockAdded({ slides: [{ heading: 'One' }] }, 'slides', fields.slides)
    expect(added.slides).toEqual([{ heading: 'One' }, { heading: 'New slide' }])
    expect(withBlockRemoved(added, 'slides', 0).slides).toEqual([{ heading: 'New slide' }])
    const fromFn = withBlockAdded({}, 'items', {
      type: 'array',
      defaultItemProps: (i: number) => ({ n: i }),
    })
    expect(fromFn.items).toEqual([{ n: 0 }])
  })
})

describe('canvas insert line', () => {
  const boxes = [
    { id: 'hero', top: 0, bottom: 400 },
    { id: 'grid', top: 400, bottom: 900 },
    { id: 'text', top: 920, bottom: 1100 },
  ]

  it('finds the edge the pointer is near, and nothing mid-section', () => {
    expect(edgeNear(boxes, 395, 12)).toEqual({ id: 'hero', side: 'bottom', y: 400 })
    expect(edgeNear(boxes, 405, 12)).toEqual({ id: 'grid', side: 'top', y: 400 })
    expect(edgeNear(boxes, 412, 12)).toEqual({ id: 'grid', side: 'top', y: 400 })
    expect(edgeNear(boxes, 200, 12)).toBeNull()
    expect(edgeNear(boxes, 915, 12)).toEqual({ id: 'text', side: 'top', y: 920 })
    expect(edgeNear(boxes, 1300, 12)).toBeNull()
  })

  it('turns an edge into the exact insert position', () => {
    const located = { zone: MAIN_ZONE, index: 1 }
    expect(targetForEdge({ side: 'top' }, located)).toEqual({ zone: MAIN_ZONE, index: 1 })
    expect(targetForEdge({ side: 'bottom' }, located)).toEqual({ zone: MAIN_ZONE, index: 2 })
  })
})
