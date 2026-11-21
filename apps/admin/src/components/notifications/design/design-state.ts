import {
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

export function addBlock(design: EmailTemplateDesign, block: FreeBlock, after?: string) {
  const at = after ? design.blocks.findIndex((b) => b.id === after) : -1
  const blocks = [...design.blocks]
  // Without a selection, new blocks go above the footer when there is one.
  const footer = blocks.findIndex((b) => b.type === 'footer')
  const index = at !== -1 ? at + 1 : footer !== -1 ? footer : blocks.length
  blocks.splice(index, 0, block)
  return { ...design, blocks }
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
