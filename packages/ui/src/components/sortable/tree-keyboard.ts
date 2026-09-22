import {
  type FlatNode,
  flatten,
  moveNode,
  projectDrop,
  removeChildrenOf,
  subtreeHeight,
  type TreeNode,
} from './tree'

/** One keyboard step while a row is picked up. */
export type KeyMove = 'up' | 'down' | 'in' | 'out'

export const KEY_MOVES: Record<string, KeyMove> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowRight: 'in',
  ArrowLeft: 'out',
}

/** The rows a drag works on: collapsed rows' children, and what the moving row carries, are out. */
export function visibleRows<T extends TreeNode>(
  items: readonly T[],
  hidden: readonly string[],
): FlatNode<T>[] {
  return removeChildrenOf(flatten(items), hidden)
}

/**
 * The tree after one keyboard step, or null when the row cannot move that way
 * (already first or last, or nesting would pass the ceiling). Up and down move
 * one visible slot and take whatever level that slot allows, exactly as a
 * pointer drag with no sideways travel would; right nests under the row above,
 * left lifts it out a level.
 */
export function keyboardMove<T extends TreeNode>(
  items: readonly T[],
  id: string,
  move: KeyMove,
  opts: { collapsed: readonly string[]; maxLevels: number },
): T[] | null {
  const rows = visibleRows(items, [id, ...opts.collapsed])
  const at = rows.findIndex((row) => row.id === id)
  const current = rows[at]
  if (!current) return null
  const overId = move === 'up' ? rows[at - 1]?.id : move === 'down' ? rows[at + 1]?.id : id
  if (!overId) return null
  const projection = projectDrop({
    flat: rows,
    activeId: id,
    overId,
    dragOffsetX: move === 'in' ? 1 : move === 'out' ? -1 : 0,
    indentWidth: 1,
    maxLevels: opts.maxLevels,
    carriedHeight: subtreeHeight(flatten(items), id),
  })
  if (!projection) return null
  const sideways = move === 'in' || move === 'out'
  if (sideways && projection.depth === current.depth) return null
  return moveNode(items, { activeId: id, overId, projection })
}

/** Where a row sits among the visible rows, for announcements: 1-based position and level. */
export function placement<T extends TreeNode>(
  items: readonly T[],
  id: string,
  collapsed: readonly string[],
): { item: Omit<T, 'children'>; position: number; total: number; level: number } | null {
  const rows = visibleRows(items, collapsed)
  const at = rows.findIndex((row) => row.id === id)
  const row = rows[at]
  if (!row) return null
  return { item: row.item, position: at + 1, total: rows.length, level: row.depth + 1 }
}
