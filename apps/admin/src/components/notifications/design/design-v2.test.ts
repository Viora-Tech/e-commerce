import {
  type ColumnsLayoutBlock,
  checkEmailDesign,
  type EmailTemplateDesign,
  FREE_BLOCK_TYPES,
} from '@commerce/notifications/design'
import { describe, expect, it } from 'vitest'
import { addCell, findBlock, moveCell, removeCell, setColumnCount } from './design-cells'
import { blockProblem } from './design-checks'
import { canUndo, historyReducer, startHistory } from './design-history'
import { duplicateBlock, insertBlock, newBlock, savePayload, updateBlock } from './design-state'
import { applyMark } from './rich-marks'

/** Edit design, version 2: the full editor's actions (23 Nov 2026). */

const base: EmailTemplateDesign = {
  version: 2,
  blocks: [
    { id: 'intro', type: 'intro' },
    { id: 'items#0', type: 'slot', slot: 'items#0' },
  ],
  removed: [],
}

const columns = (d: EmailTemplateDesign) =>
  d.blocks.find((b): b is ColumnsLayoutBlock => b.type === 'columns') as ColumnsLayoutBlock

describe('new blocks', () => {
  it('every block in the palette starts in a shape the server reads back (once it is filled in)', () => {
    for (const type of FREE_BLOCK_TYPES) {
      let block = newBlock(type)
      // What the merchant must fill before Save: a picture, a code, a label, a video link.
      if (block.type === 'image' || block.type === 'hero')
        block = { ...block, src: '/media/a.webp' }
      if (block.type === 'video')
        block = { ...block, src: '/media/a.webp', url: 'https://youtu.be/x' }
      if (block.type === 'coupon') block = { ...block, code: 'SAVE10' }
      if (block.type === 'button') block = { ...block, label: 'Shop' }
      const payload = savePayload(insertBlock(base, block, 1))
      const r = checkEmailDesign(JSON.parse(JSON.stringify(payload)))
      expect(r.ok, `${type}: ${r.ok ? '' : r.issues.join(', ')}`).toBe(true)
    }
  })

  it('new text blocks take rich text', () => {
    expect(newBlock('text')).toMatchObject({ rich: true })
  })

  it('flags what a new block still needs', () => {
    const vars = ['shop_url']
    expect(blockProblem(newBlock('hero'), vars)?.empty).toBe(true)
    expect(blockProblem(newBlock('coupon'), vars)?.empty).toBe(true)
    expect(
      blockProblem({ ...newBlock('video'), src: '/m.webp', url: 'ftp://x' } as never, vars)
        ?.badLink,
    ).toBe(true)
    expect(blockProblem({ ...newBlock('html'), html: '{{nope}}' } as never, vars)?.unknown).toEqual(
      ['nope'],
    )
  })
})

describe('columns', () => {
  const withColumns = insertBlock(base, newBlock('columns'), 1)

  it('adds, finds, moves and removes blocks inside a column', () => {
    const cols = columns(withColumns)
    const added = addCell(withColumns, cols.id, 0, 'button')
    expect(added.id).not.toBeNull()
    const found = findBlock(added.design, added.id)
    expect(found?.parent?.id).toBe(cols.id)
    const moved = moveCell(added.design, added.id as string, -1)
    expect(columns(moved).cells[0]?.[0]?.id).toBe(added.id)
    expect(findBlock(removeCell(moved, added.id as string), added.id)).toBeNull()
  })

  it('fewer columns keep the blocks of the dropped ones', () => {
    const three = setColumnCount(columns(withColumns), 3)
    expect(three.cells).toHaveLength(3)
    const one = setColumnCount(three, 1)
    expect(one.cells).toHaveLength(1)
    expect(one.cells[0]).toHaveLength(3)
  })

  it('updates a block inside a column and duplicates columns with new ids', () => {
    const cols = columns(withColumns)
    const inner = cols.cells[0]?.[0]
    const next = updateBlock(withColumns, inner?.id as string, { text: 'Hello' })
    expect(findBlock(next, inner?.id as string)?.block).toMatchObject({ text: 'Hello' })
    const copy = duplicateBlock(next, cols.id)
    const ids = copy.design.blocks.flatMap((b) =>
      b.type === 'columns' ? [b.id, ...b.cells.flat().map((c) => c.id)] : [b.id],
    )
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('order blocks and styles', () => {
  it('a slot takes only its edit and box', () => {
    const next = updateBlock(base, 'items#0', {
      edit: { hide: ['image'] },
      box: { top: 'small' },
      slot: 'ticket#0',
    } as never)
    expect(next.blocks[1]).toEqual({
      id: 'items#0',
      type: 'slot',
      slot: 'items#0',
      edit: { hide: ['image'] },
      box: { top: 'small' },
    })
  })

  it('saves styles and drops an empty set', () => {
    const styled = { ...base, styles: { font: 'arial' as const } }
    expect(savePayload(styled).styles).toEqual({ font: 'arial' })
    expect('styles' in savePayload({ ...base, styles: {} })).toBe(false)
    const r = checkEmailDesign(savePayload(styled))
    expect(r.ok && r.design.styles).toEqual({ font: 'arial' })
  })

  it('style changes in a row are one undo step', () => {
    let h = startHistory(base)
    for (const size of [14, 16, 17]) {
      h =
        historyReducer(h, {
          type: 'change',
          design: { ...base, styles: { size } },
          group: 'styles',
        }) ?? h
    }
    expect(h.past).toHaveLength(1)
    expect(canUndo(h)).toBe(true)
  })
})

describe('rich text toolbar', () => {
  it('wraps words, makes links and lists', () => {
    expect(applyMark('say hi', 4, 6, 'bold', 'words')).toEqual({
      text: 'say **hi**',
      start: 6,
      end: 8,
    })
    expect(applyMark('', 0, 0, 'italic', 'words').text).toBe('*words*')
    const link = applyMark('see shop', 4, 8, 'link', 'words')
    expect(link.text).toBe('see [shop](https://)')
    expect(link.text.slice(link.start, link.end)).toBe('https://')
    expect(applyMark('a\nb', 0, 3, 'list', 'w').text).toBe('- a\n- b')
    expect(applyMark('- a\n- b', 0, 7, 'numbered', 'w').text).toBe('1. a\n2. b')
  })
})
