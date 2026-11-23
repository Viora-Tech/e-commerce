import {
  type CellBlock,
  type ColumnsLayoutBlock,
  DESIGN_LIMITS,
  type DesignBlock,
  type EmailTemplateDesign,
} from '@commerce/notifications/design'
import { newCell } from './design-state'

/**
 * The Columns block's inside: finding a block by id anywhere in the design, adding, removing
 * and moving the blocks of one column, and changing the number of columns. Pure.
 */

export type Found = { block: DesignBlock | CellBlock; parent: ColumnsLayoutBlock | null }

/** A block by id, at the top level or inside a column (with the Columns block around it). */
export function findBlock(design: EmailTemplateDesign, id: string | null): Found | null {
  if (!id) return null
  for (const b of design.blocks) {
    if (b.id === id) return { block: b, parent: null }
    if (b.type === 'columns') {
      const inner = b.cells.flat().find((c) => c.id === id)
      if (inner) return { block: inner, parent: b }
    }
  }
  return null
}

function mapColumns(
  design: EmailTemplateDesign,
  id: string,
  fn: (b: ColumnsLayoutBlock) => ColumnsLayoutBlock,
): EmailTemplateDesign {
  return {
    ...design,
    blocks: design.blocks.map((b) => (b.id === id && b.type === 'columns' ? fn(b) : b)),
  }
}

/** Adds a block at the end of one column; `id` is the new block's (to select it). */
export function addCell(
  design: EmailTemplateDesign,
  columnsId: string,
  column: number,
  type: CellBlock['type'],
): { design: EmailTemplateDesign; id: string | null } {
  const cell = newCell(type)
  let added = false
  const next = mapColumns(design, columnsId, (b) => ({
    ...b,
    cells: b.cells.map((c, i) => {
      if (i !== column || c.length >= DESIGN_LIMITS.cell) return c
      added = true
      return [...c, cell]
    }),
  }))
  return added ? { design: next, id: cell.id } : { design, id: null }
}

export function removeCell(design: EmailTemplateDesign, id: string): EmailTemplateDesign {
  const found = findBlock(design, id)
  if (!found?.parent) return design
  return mapColumns(design, found.parent.id, (b) => ({
    ...b,
    cells: b.cells.map((c) => c.filter((x) => x.id !== id)),
  }))
}

/** Moves a block up or down within its column. */
export function moveCell(design: EmailTemplateDesign, id: string, by: -1 | 1) {
  const found = findBlock(design, id)
  if (!found?.parent) return design
  return mapColumns(design, found.parent.id, (b) => ({
    ...b,
    cells: b.cells.map((c) => {
      const i = c.findIndex((x) => x.id === id)
      const j = i + by
      if (i === -1 || j < 0 || j >= c.length) return c
      const next = [...c]
      const [moved] = next.splice(i, 1)
      if (moved) next.splice(j, 0, moved)
      return next
    }),
  }))
}

/**
 * One, two or three columns. Fewer columns move the blocks of the dropped columns into the
 * last one kept, so nothing typed is lost.
 */
export function setColumnCount(block: ColumnsLayoutBlock, count: number): ColumnsLayoutBlock {
  const n = Math.min(3, Math.max(1, count))
  if (n === block.cells.length) return block
  if (n > block.cells.length) {
    const extra = Array.from({ length: n - block.cells.length }, () => [newCell('text')])
    return { ...block, cells: [...block.cells, ...extra] }
  }
  const kept = block.cells.slice(0, n)
  const spill = block.cells.slice(n).flat()
  const last = kept[n - 1] ?? []
  kept[n - 1] = [...last, ...spill].slice(0, DESIGN_LIMITS.cell)
  return { ...block, cells: kept }
}
