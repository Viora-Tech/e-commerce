import { describe, expect, it } from 'vitest'
import { blockLanding, slotAllows } from './customize-add-block'
import type { CustomizeDoc } from './customize-doc'

const doc = {
  root: { props: {} },
  content: [
    {
      type: 'SplitHero',
      props: {
        id: 'hero',
        content: [
          { type: 'Heading', props: { id: 'h' } },
          { type: 'Button', props: { id: 'b', _name: 'Shop button' } },
        ],
        columns: [{ content: [] }],
      },
    },
  ],
  zones: {},
} as unknown as CustomizeDoc

const fields = (type: string) =>
  type === 'SplitHero'
    ? {
        content: { type: 'slot', allow: ['Heading', 'Text'] },
        columns: { type: 'array', arrayFields: { content: { type: 'slot' } } },
      }
    : undefined

describe('slotAllows', () => {
  it("reads the slot field's allow list, also inside an array item", () => {
    expect(slotAllows(doc, 'hero:content', fields)).toEqual(['Heading', 'Text'])
    expect(slotAllows(doc, 'hero:columns.0.content', fields)).toBeNull()
    expect(slotAllows(doc, 'root:default-zone', fields)).toBeNull()
  })
})

describe('blockLanding', () => {
  it('names the parent and the block above the insert point', () => {
    const after = blockLanding(doc, 'hero:content', 2)
    expect(after.parent?.props.id).toBe('hero')
    expect(after.before?.props.id).toBe('b')
    expect(blockLanding(doc, 'hero:content', 0).before).toBeNull()
  })
})
