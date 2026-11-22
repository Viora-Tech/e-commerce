import {
  DESIGN_LIMITS,
  type DesignBlock,
  type EmailTemplateDesign,
  type FreeBlock,
  type FreeBlockType,
  isSafeLink,
  slotKind,
  slotLocked,
  unknownVariables,
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
      return { id, type, text: '', align: 'center', muted: false }
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
  }
}

/** Locked: the intro and the order's own data blocks never go; plain built-in lines may. */
export function isLocked(block: DesignBlock): boolean {
  if (block.type === 'intro') return true
  return block.type === 'slot' && slotLocked(block.slot)
}

/** Whether the block's settings can be changed (built-in data blocks cannot). */
export function isEditable(block: DesignBlock): boolean {
  return block.type !== 'slot'
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
  const copy = { ...block, id: newId(block.type) } as FreeBlock
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

export function updateBlock(
  design: EmailTemplateDesign,
  id: string,
  patch: Partial<FreeBlock> | Partial<Extract<DesignBlock, { type: 'intro' }>>,
): EmailTemplateDesign {
  return {
    ...design,
    blocks: design.blocks.map((b) =>
      b.id === id && b.type !== 'slot' ? ({ ...b, ...patch } as DesignBlock) : b,
    ),
  }
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
    default:
      return ''
  }
}

/** Every text field of a block that may hold variables. */
function textsOf(block: DesignBlock): string[] {
  switch (block.type) {
    case 'intro':
      return [block.eyebrow ?? '', block.heading ?? '', block.lead ?? '']
    case 'heading':
    case 'text':
      return [block.text]
    case 'image':
      return [block.alt, block.href ?? '']
    case 'button':
      return [block.label, block.url]
    case 'divider':
      return [block.label]
    default:
      return []
  }
}

export type BlockProblem = { unknown: string[]; badLink: boolean; empty: boolean }

/** What is wrong with a block before it can be saved; null when it is fine. */
export function blockProblem(
  block: DesignBlock,
  variables: readonly string[],
): BlockProblem | null {
  const unknown = [...new Set(textsOf(block).flatMap((t) => unknownVariables(t, variables)))]
  const badLink =
    (block.type === 'button' && !isSafeLink(block.url)) ||
    (block.type === 'image' && Boolean(block.href) && !isSafeLink(block.href ?? ''))
  const empty =
    (block.type === 'button' && !block.label.trim()) || (block.type === 'image' && !block.src)
  return unknown.length > 0 || badLink || empty ? { unknown, badLink, empty } : null
}

export function subjectUnknown(design: EmailTemplateDesign, variables: readonly string[]) {
  return unknownVariables(design.subject ?? '', variables)
}
