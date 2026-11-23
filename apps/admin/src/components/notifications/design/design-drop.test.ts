import {
  DESIGN_LIMITS,
  type EmailTemplateDesign,
  parseEmailDesign,
} from '@commerce/notifications/design'
import { describe, expect, it } from 'vitest'
import { applyDrop, END_ZONE_ID, paletteDragId, paletteType } from './design-drop'
import {
  addBlock,
  canAdd,
  duplicateBlock,
  insertBlock,
  moveBlock,
  newBlock,
  removeBlock,
  savePayload,
} from './design-state'

const design: EmailTemplateDesign = {
  version: 2,
  subject: '  Your order {{order_number}}  ',
  blocks: [
    { id: 'logo', type: 'logo', menu: true },
    { id: 'intro', type: 'intro' },
    { id: 'items#0', type: 'slot', slot: 'items#0' },
    { id: 'hello', type: 'text', text: 'Hello', align: 'center', muted: false },
    { id: 'footer', type: 'footer', social: true },
  ],
  removed: [],
}

const ids = (d: EmailTemplateDesign) => d.blocks.map((b) => b.id)

function fullDesign(): EmailTemplateDesign {
  const blocks = Array.from({ length: DESIGN_LIMITS.blocks }, (_, i) => ({
    id: `s${i}`,
    type: 'spacer' as const,
    size: 'small' as const,
  }))
  return { version: 2, blocks, removed: [] }
}

describe('Edit design: moving blocks', () => {
  it('moves a block down and up', () => {
    expect(ids(moveBlock(design, 0, 3))).toEqual(['intro', 'items#0', 'hello', 'logo', 'footer'])
    expect(ids(moveBlock(design, 3, 1))).toEqual(['logo', 'hello', 'intro', 'items#0', 'footer'])
  })

  it('ignores a move out of range or onto itself', () => {
    expect(moveBlock(design, 2, 2)).toBe(design)
    expect(moveBlock(design, -1, 2)).toBe(design)
    expect(moveBlock(design, 0, 9)).toBe(design)
  })

  it('a row dropped on another takes its place; on the end zone it goes last', () => {
    expect(ids(applyDrop(design, 'hello', 'logo').design)[0]).toBe('hello')
    expect(ids(applyDrop(design, 'logo', END_ZONE_ID).design).at(-1)).toBe('logo')
    expect(applyDrop(design, 'logo', 'logo').design).toBe(design)
    expect(applyDrop(design, 'logo', null).design).toBe(design)
  })
})

describe('Edit design: adding blocks', () => {
  it('recognises palette drags and nothing else', () => {
    expect(paletteType(paletteDragId('heading'))).toBe('heading')
    expect(paletteType('hello')).toBeNull()
    expect(paletteType('new:intro')).toBeNull()
    expect(paletteType(42)).toBeNull()
  })

  it('a palette tile dropped on a block goes in above it, and is reported as added', () => {
    const { design: next, added } = applyDrop(design, paletteDragId('button'), 'items#0')
    expect(next.blocks[2]?.type).toBe('button')
    expect(next.blocks[2]?.id).toBe(added)
    expect(next.blocks[3]?.id).toBe('items#0')
  })

  it('a palette tile dropped on the end zone goes last; outside the list it does nothing', () => {
    expect(
      applyDrop(design, paletteDragId('divider'), END_ZONE_ID).design.blocks.at(-1)?.type,
    ).toBe('divider')
    expect(applyDrop(design, paletteDragId('divider'), 'nowhere')).toEqual({ design, added: null })
  })

  it('a click adds below the selected block, or above the footer', () => {
    expect(ids(addBlock(design, newBlock('text'), 'logo'))[1]).toMatch(/^text-/)
    expect(ids(addBlock(design, newBlock('text'))).at(-2)).toMatch(/^text-/)
  })

  it('stops at the block limit', () => {
    const full = fullDesign()
    expect(canAdd(full)).toBe(false)
    expect(insertBlock(full, newBlock('text'), 0)).toBe(full)
    expect(applyDrop(full, paletteDragId('text'), 's0')).toEqual({ design: full, added: null })
  })
})

describe('Edit design: duplicate and remove', () => {
  it('copies a free block right below it with a new id', () => {
    const { design: next, id } = duplicateBlock(design, 'hello')
    expect(id).not.toBe('hello')
    expect(next.blocks[4]).toEqual({ ...design.blocks[3], id })
  })

  it('never copies the intro or the order blocks', () => {
    expect(duplicateBlock(design, 'intro')).toEqual({ design, id: null })
    expect(duplicateBlock(design, 'items#0')).toEqual({ design, id: null })
    expect(duplicateBlock(fullDesign(), 's0').id).toBeNull()
  })

  it('removes a free block and keeps locked ones', () => {
    expect(ids(removeBlock(design, 'hello'))).not.toContain('hello')
    expect(removeBlock(design, 'items#0')).toBe(design)
  })
})

describe('Edit design: what Save sends', () => {
  it('sends the stored design shape with a trimmed subject', () => {
    expect(savePayload(design)).toEqual({
      version: 2,
      subject: 'Your order {{order_number}}',
      blocks: design.blocks,
      removed: [],
    })
  })

  it('drops an empty subject', () => {
    expect('subject' in savePayload({ ...design, subject: '   ' })).toBe(false)
  })

  it('survives the server check unchanged after editing', () => {
    let d = applyDrop(design, paletteDragId('heading'), 'hello').design
    d = duplicateBlock(d, 'hello').design
    d = applyDrop(d, 'logo', END_ZONE_ID).design
    d = removeBlock(d, 'footer')
    const payload = savePayload(d)
    expect(parseEmailDesign(JSON.parse(JSON.stringify(payload)))).toEqual(payload)
  })
})
