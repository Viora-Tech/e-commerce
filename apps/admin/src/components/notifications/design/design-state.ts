import {
  type CellBlock,
  DESIGN_LIMITS,
  type DesignBlock,
  type EmailTemplateDesign,
  type FreeBlock,
  type FreeBlockType,
  type IntroBlock,
  type SlotBlock,
  slotKind,
  slotLocked,
} from '@commerce/notifications/design'
import type { emailDesignContent } from '@/data/email-design'

/**
 * The editor's pure side (Settings → Notifications → Edit design): new blocks, the lock rule,
 * removing and changing a block, names and problems. The components only call these.
 */

type Copy = typeof emailDesignContent

let counter = 0
/** A short id unique within one design. */
function newId(type: string): string {
  counter += 1
  return `${type}-${Date.now().toString(36)}${counter.toString(36)}`
}

export function newBlock(type: FreeBlockType): FreeBlock {
  const id = newId(type)
  switch (type) {
    case 'logo':
      return { id, type, menu: true }
    case 'heading':
      return { id, type, text: '', size: 'large' }
    case 'text':
      // New text blocks take bold, italic, links and lists; old ones stay plain.
      return { id, type, text: '', align: 'center', muted: false, rich: true }
    case 'image':
      return { id, type, src: '', alt: '', width: 100 }
    case 'button':
      return { id, type, label: '', url: '{{shop_url}}' }
    case 'divider':
      return { id, type, label: '' }
    case 'spacer':
      return { id, type, size: 'medium' }
    case 'social':
      return { id, type }
    case 'help':
      return { id, type }
    case 'footer':
      return { id, type, social: true }
    case 'hero':
      return {
        id,
        type,
        src: '',
        alt: '',
        heading: '',
        text: '',
        buttonLabel: '',
        buttonUrl: '{{shop_url}}',
      }
    case 'products':
      return { id, type, title: '', items: [], columns: 3, showPrice: true, buttonLabel: '' }
    case 'coupon':
      return { id, type, code: '', label: '', note: '', value: '', valueNote: '' }
    case 'video':
      return { id, type, src: '', url: '', alt: '', label: '' }
    case 'html':
      return { id, type, html: '' }
    case 'columns':
      return {
        id,
        type,
        stack: true,
        cells: [[newCell('text')], [newCell('text')]],
      }
  }
}

/** A new block inside a column. */
export function newCell(type: CellBlock['type']): CellBlock {
  return newBlock(type) as CellBlock
}

/** Locked: the intro and the order's own data blocks never go; plain built-in lines may. */
export function isLocked(block: DesignBlock): boolean {
  if (block.type === 'intro') return true
  return block.type === 'slot' && slotLocked(block.slot)
}

/** Every block has settings now: the order's own blocks take words, colours and a box. */
export function isEditable(_block: DesignBlock): boolean {
  return true
}

/** Whether another block fits (the server keeps the first 60). */
export function canAdd(design: EmailTemplateDesign): boolean {
  return design.blocks.length < DESIGN_LIMITS.blocks
}

export function addBlock(design: EmailTemplateDesign, block: FreeBlock, after?: string) {
  const at = after ? design.blocks.findIndex((b) => b.id === after) : -1
  // Without a selection, new blocks go above the footer when there is one.
  const footer = design.blocks.findIndex((b) => b.type === 'footer')
  const index = at !== -1 ? at + 1 : footer !== -1 ? footer : design.blocks.length
  return insertBlock(design, block, index)
}

/** Puts a new block at a place in the list (a block dragged in from the palette). */
export function insertBlock(
  design: EmailTemplateDesign,
  block: FreeBlock,
  index: number,
): EmailTemplateDesign {
  if (!canAdd(design)) return design
  const at = Math.max(0, Math.min(index, design.blocks.length))
  const blocks = [...design.blocks]
  blocks.splice(at, 0, block)
  return { ...design, blocks }
}

/** Moves the block at `from` to `to` (drag or keyboard); out of range leaves the design as is. */
export function moveBlock(design: EmailTemplateDesign, from: number, to: number) {
  const n = design.blocks.length
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return design
  const blocks = [...design.blocks]
  const [moved] = blocks.splice(from, 1)
  if (!moved) return design
  blocks.splice(to, 0, moved)
  return { ...design, blocks }
}

/** Whether a block can be copied: the merchant's own blocks only (one intro, one of each slot). */
export function canDuplicate(block: DesignBlock): block is FreeBlock {
  return block.type !== 'slot' && block.type !== 'intro'
}

/** A copy of a free block with a new id, right below it; `id` is the copy's (to select it). */
export function duplicateBlock(
  design: EmailTemplateDesign,
  id: string,
): { design: EmailTemplateDesign; id: string | null } {
  const index = design.blocks.findIndex((b) => b.id === id)
  const block = design.blocks[index]
  if (!block || !canDuplicate(block) || !canAdd(design)) return { design, id: null }
  const copy = (
    block.type === 'columns'
      ? {
          ...block,
          id: newId(block.type),
          cells: block.cells.map((cell) => cell.map((c) => ({ ...c, id: newId(c.type) }))),
        }
      : { ...block, id: newId(block.type) }
  ) as FreeBlock
  return { design: insertBlock(design, copy, index + 1), id: copy.id }
}

/**
 * The body of "Save design": exactly the JSON the server stores (email_template_design).
 * The subject is trimmed and dropped when empty; nothing else is added.
 */
export function savePayload(design: EmailTemplateDesign): EmailTemplateDesign {
  const subject = design.subject?.trim()
  return {
    version: design.version,
    ...(subject ? { subject } : {}),
    ...(design.styles && Object.keys(design.styles).length > 0 ? { styles: design.styles } : {}),
    blocks: design.blocks,
    removed: design.removed,
  }
}

/** Removes a block; a locked one stays. A removed built-in line is remembered as removed. */
export function removeBlock(design: EmailTemplateDesign, id: string): EmailTemplateDesign {
  const block = design.blocks.find((b) => b.id === id)
  if (!block || isLocked(block)) return design
  return {
    ...design,
    blocks: design.blocks.filter((b) => b.id !== id),
    removed: block.type === 'slot' ? [...new Set([...design.removed, block.slot])] : design.removed,
  }
}

export type BlockPatch = Partial<FreeBlock> | Partial<IntroBlock> | Partial<SlotBlock>

/** Changes a block, top level or inside a column; a slot only takes its edit and box. */
export function updateBlock(
  design: EmailTemplateDesign,
  id: string,
  patch: BlockPatch,
): EmailTemplateDesign {
  const apply = <T extends DesignBlock>(b: T): T => {
    if (b.id === id) {
      if (b.type !== 'slot') return { ...b, ...patch } as T
      const p = patch as Partial<SlotBlock>
      return {
        ...b,
        ...('edit' in p ? { edit: p.edit } : {}),
        ...('box' in p ? { box: p.box } : {}),
      }
    }
    if (b.type === 'columns') {
      return { ...b, cells: b.cells.map((cell) => cell.map((c) => apply(c))) }
    }
    return b
  }
  return { ...design, blocks: design.blocks.map(apply) }
}

/** The block's name in the list ("Items and totals", "Text"). */
export function blockTitle(block: DesignBlock, copy: Copy): string {
  if (block.type === 'slot') {
    const kind = slotKind(block.slot)
    return copy.slots[kind] ?? kind
  }
  return copy.blocks[block.type]
}

/** A short line of what the block says, for the list. */
export function blockSummary(block: DesignBlock): string {
  switch (block.type) {
    case 'heading':
    case 'text':
      return block.text.split('\n')[0] ?? ''
    case 'button':
      return block.label
    case 'divider':
      return block.label
    case 'intro':
      return block.heading ?? ''
    case 'hero':
      return block.heading
    case 'coupon':
      return block.code
    case 'video':
      return block.label
    case 'products':
      return block.title
    case 'columns':
      return String(block.cells.length)
    default:
      return ''
  }
}

export { type BlockProblem, blockProblem, subjectUnknown } from './design-checks'
