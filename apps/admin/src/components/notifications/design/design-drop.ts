import {
  type EmailTemplateDesign,
  FREE_BLOCK_TYPES,
  type FreeBlockType,
} from '@commerce/notifications/design'
import { insertBlock, moveBlock, newBlock } from './design-state'

/**
 * The drag side of the email editor, without React: which drag is which (a block in the
 * list or a new one from the palette) and what a drop does to the design.
 */

/** Palette tiles drag with this id prefix so they never clash with a block id. */
const PALETTE_PREFIX = 'new:'

/** The drop zone under the last block (a new block lands at the very end). */
export const END_ZONE_ID = 'design-end-zone'

export function paletteDragId(type: FreeBlockType): string {
  return `${PALETTE_PREFIX}${type}`
}

/** The block type a palette tile adds, or null when the drag is a block already in the list. */
export function paletteType(dragId: unknown): FreeBlockType | null {
  if (typeof dragId !== 'string' || !dragId.startsWith(PALETTE_PREFIX)) return null
  const type = dragId.slice(PALETTE_PREFIX.length)
  return (FREE_BLOCK_TYPES as readonly string[]).includes(type) ? (type as FreeBlockType) : null
}

/** Where a drop over `overId` puts a new block: in that block's place, or last for the end zone. */
export function dropIndex(design: EmailTemplateDesign, overId: unknown): number {
  if (overId === END_ZONE_ID) return design.blocks.length
  return design.blocks.findIndex((b) => b.id === overId)
}

export type DropResult = {
  design: EmailTemplateDesign
  /** The id of a block added from the palette, to select it. */
  added: string | null
}

/**
 * A finished drag: a palette tile dropped on the list adds that block there; a block dropped
 * on another takes its place. Anything else (dropped outside, on itself) changes nothing.
 */
export function applyDrop(
  design: EmailTemplateDesign,
  activeId: unknown,
  overId: unknown,
): DropResult {
  const unchanged = { design, added: null }
  if (overId === null || overId === undefined) return unchanged
  const type = paletteType(activeId)
  if (type) {
    const at = dropIndex(design, overId)
    if (at === -1) return unchanged
    const block = newBlock(type)
    const next = insertBlock(design, block, at)
    return next === design ? unchanged : { design: next, added: block.id }
  }
  if (activeId === overId) return unchanged
  const from = design.blocks.findIndex((b) => b.id === activeId)
  const to =
    overId === END_ZONE_ID
      ? design.blocks.length - 1
      : design.blocks.findIndex((b) => b.id === overId)
  return { design: moveBlock(design, from, to), added: null }
}
