import { describe, expect, it } from 'vitest'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE } from './customize-doc'
import {
  findBlock,
  hasSlots,
  insertCopyActions,
  locateBlock,
  moveOutActions,
  parsePropPath,
  reorderActions,
  slotOwner,
  slotZones,
  stepActions,
  zoneItems,
} from './customize-slots'

const h = (id: string) => ({ type: 'Heading', props: { id, text: id } })

/** Hero, then a Group holding a heading and Columns whose second column holds two headings. */
const doc = (): CustomizeDoc => ({
  root: { props: {} },
  content: [
    { type: 'Hero', props: { id: 'hero' } },
    {
      type: 'Group',
      props: {
        id: 'group',
        content: [
          h('intro'),
          {
            type: 'Columns',
            props: {
              id: 'cols',
              columns: [{ content: [] }, { content: [h('a'), h('b')] }],
            },
          },
        ],
      },
    },
  ],
  zones: { [HEADER_ZONE]: [{ type: 'Header', props: { id: 'header' } }], [FOOTER_ZONE]: [] },
})

const columnsFields = {
  columns: {
    type: 'array',
    label: 'Columns',
    getItemSummary: (_: unknown, i?: number) => `Column ${(i ?? 0) + 1}`,
    arrayFields: { content: { type: 'slot', label: 'Content' } },
  },
  gap: { type: 'number' },
}

describe('slot zones', () => {
  it('names zones as Puck does, through array items', () => {
    const cols = findBlock(doc(), 'cols')
    const zones = slotZones(cols?.props ?? {}, columnsFields)
    expect(zones.map((z) => [z.zone, z.label, z.items.length])).toEqual([
      ['cols:columns[0].content', 'Column 1', 0],
      ['cols:columns[1].content', 'Column 2', 2],
    ])
    expect(hasSlots(columnsFields)).toBe(true)
    expect(hasSlots({ text: { type: 'text' } })).toBe(false)
  })

  it('parses prop paths', () => {
    expect(parsePropPath('columns[1].content')).toEqual(['columns', 1, 'content'])
    expect(parsePropPath('content')).toEqual(['content'])
  })

  it('finds blocks and their zone at any depth', () => {
    expect(locateBlock(doc(), 'hero')).toEqual({ zone: 'root:default-zone', index: 0 })
    expect(locateBlock(doc(), 'intro')).toEqual({ zone: 'group:content', index: 0 })
    expect(locateBlock(doc(), 'b')).toEqual({ zone: 'cols:columns[1].content', index: 1 })
    expect(locateBlock(doc(), 'header')).toEqual({ zone: HEADER_ZONE, index: 0 })
    expect(locateBlock(doc(), 'missing')).toBeNull()
  })

  it('reads a slot zone’s items and owner', () => {
    expect(zoneItems(doc(), 'cols:columns[1].content').map((b) => b.props.id)).toEqual(['a', 'b'])
    expect(zoneItems(doc(), 'cols:columns[0].content')).toEqual([])
    expect(zoneItems(doc(), 'nope:content')).toEqual([])
    expect(slotOwner(doc(), 'cols:columns[1].content')).toEqual({
      id: 'cols',
      zone: 'group:content',
      index: 1,
    })
    expect(slotOwner(doc(), 'root:default-zone')).toBeNull()
  })
})

describe('tree actions on nested zones', () => {
  it('a drag inside a slot is one reorder on that slot’s zone', () => {
    expect(reorderActions('cols:columns[1].content', ['a', 'b'], ['b', 'a'])).toEqual([
      {
        type: 'reorder',
        sourceIndex: 1,
        destinationIndex: 0,
        destinationZone: 'cols:columns[1].content',
      },
      { type: 'setUi', ui: { itemSelector: { index: 0, zone: 'cols:columns[1].content' } } },
    ])
    expect(reorderActions('group:content', ['x'], ['x'])).toEqual([])
  })

  it('keyboard move up and down stay inside the zone', () => {
    expect(stepActions('group:content', 0, 2, -1)).toEqual([])
    expect(stepActions('group:content', 0, 2, 1)[0]).toMatchObject({
      type: 'reorder',
      sourceIndex: 0,
      destinationIndex: 1,
      destinationZone: 'group:content',
    })
    expect(stepActions('group:content', 1, 2, 1)).toEqual([])
  })

  it('move out puts the block right after its container', () => {
    expect(moveOutActions(doc(), 'cols:columns[1].content', 0)[0]).toEqual({
      type: 'move',
      sourceIndex: 0,
      sourceZone: 'cols:columns[1].content',
      destinationIndex: 2,
      destinationZone: 'group:content',
    })
    expect(moveOutActions(doc(), 'root:default-zone', 0)).toEqual([])
  })

  it('paste inserts a copy with fresh ids at every depth, as one undo step', () => {
    const group = findBlock(doc(), 'group')
    if (!group) throw new Error('fixture')
    let n = 0
    const actions = insertCopyActions(
      { zone: 'root:default-zone', index: 1 },
      group,
      2,
      (t) => `${t}-${++n}`,
    )
    expect(actions[0]).toMatchObject({ type: 'insert', recordHistory: false, id: 'Group-5' })
    const replace = actions[1] as { data: { props: Record<string, unknown> } }
    const json = JSON.stringify(replace.data)
    for (const old of ['"group"', '"intro"', '"cols"', '"a"', '"b"'])
      expect(json).not.toContain(`"id":${old}`)
    expect(json.match(/"id":/g)).toHaveLength(5)
    expect(actions[2]).toEqual({
      type: 'setUi',
      ui: { itemSelector: { index: 1, zone: 'root:default-zone' } },
    })
  })
})
