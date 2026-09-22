/**
 * Pure tree helpers behind SortableTree. A drag works on a flattened list (one
 * row per node, with its depth and parent) because that is what a vertical
 * sortable list can render and reorder; the stored shape is the nested tree.
 * These convert between the two, compute where a drag will land, and edit the
 * tree in place of a server round trip.
 *
 * No React, no dnd-kit: importable anywhere through `@commerce/ui/sortable/tree`.
 */

/** Anything with an id and optional children: a navigation item, or a test fixture. */
export type TreeNode = { id: string; children?: TreeNode[] | undefined }

export type FlatNode<T extends TreeNode> = {
  id: string
  parentId: string | null
  /** 0 for a top-level item. */
  depth: number
  /** Position among its siblings. */
  index: number
  /** The item itself, without its children (those are separate rows). */
  item: Omit<T, 'children'>
}

/** Default nesting ceiling: three levels, as Shopify's menus. */
export const TREE_MAX_LEVELS = 3

function withoutChildren<T extends TreeNode>(node: T): Omit<T, 'children'> {
  const { children: _children, ...rest } = node
  return rest
}

/** Depth-first rows, parents before their children, siblings in order. */
export function flatten<T extends TreeNode>(
  items: readonly T[],
  parentId: string | null = null,
  depth = 0,
): FlatNode<T>[] {
  return items.flatMap((node, index) => [
    { id: node.id, parentId, depth, index, item: withoutChildren(node) },
    ...flatten((node.children ?? []) as T[], node.id, depth + 1),
  ])
}

/**
 * The nested tree back from rows. Children follow their parent's `parentId`,
 * in row order; an item whose parent is missing is kept at the top level
 * rather than dropped. Empty `children` arrays are omitted from the output.
 */
export function buildTree<T extends TreeNode>(flat: readonly FlatNode<T>[]): T[] {
  const byId = new Map<string, T>()
  for (const row of flat) byId.set(row.id, { ...row.item } as T)
  const roots: T[] = []
  for (const row of flat) {
    const node = byId.get(row.id) as T
    const parent = row.parentId === null ? undefined : byId.get(row.parentId)
    if (parent) {
      parent.children = [...(parent.children ?? []), node]
    } else {
      roots.push(node)
    }
  }
  return roots
}

/** Moves one element of a list; used on rows, never mutates the input. */
export function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const [moved] = next.splice(from, 1)
  if (moved !== undefined) next.splice(to, 0, moved)
  return next
}

/**
 * Drops the descendants of the given ids. While a parent is being dragged its
 * children travel with it, so they leave the list the drag is computed on.
 */
export function removeChildrenOf<T extends TreeNode>(
  flat: readonly FlatNode<T>[],
  ids: readonly string[],
): FlatNode<T>[] {
  const excluded = new Set(ids)
  return flat.filter((row) => {
    if (row.parentId !== null && excluded.has(row.parentId)) {
      excluded.add(row.id)
      return false
    }
    return true
  })
}

/** How many rows sit anywhere below this one. */
export function countDescendants<T extends TreeNode>(
  flat: readonly FlatNode<T>[],
  id: string,
): number {
  const at = flat.findIndex((row) => row.id === id)
  if (at === -1) return 0
  const depth = flat[at]?.depth ?? 0
  let count = 0
  for (let i = at + 1; i < flat.length; i++) {
    if ((flat[i]?.depth ?? 0) <= depth) break
    count++
  }
  return count
}

/** Levels below this row, 0 for a leaf. A parent with grandchildren is 2. */
export function subtreeHeight<T extends TreeNode>(
  flat: readonly FlatNode<T>[],
  id: string,
): number {
  const at = flat.findIndex((row) => row.id === id)
  if (at === -1) return 0
  const depth = flat[at]?.depth ?? 0
  let height = 0
  for (let i = at + 1; i < flat.length; i++) {
    const d = flat[i]?.depth ?? 0
    if (d <= depth) break
    height = Math.max(height, d - depth)
  }
  return height
}

export type Projection = { depth: number; parentId: string | null }

/**
 * Where the dragged row lands: the dnd-kit SortableTree projection. The row
 * moves to `overId`'s slot, and the pointer's horizontal travel picks its
 * depth, one level per `indentWidth`. The depth is clamped so the tree stays
 * valid: no deeper than one below the row above it, no shallower than the
 * row below it (which would orphan that row), and never so deep that the
 * row's own children would pass the level ceiling.
 *
 * `flat` should already exclude the dragged row's descendants
 * (see `removeChildrenOf`); pass the height of what it carries.
 */
export function projectDrop<T extends TreeNode>(args: {
  flat: readonly FlatNode<T>[]
  activeId: string
  overId: string
  dragOffsetX: number
  indentWidth: number
  maxLevels?: number
  carriedHeight?: number
}): Projection | null {
  const { flat, activeId, overId, dragOffsetX, indentWidth } = args
  const maxLevels = args.maxLevels ?? TREE_MAX_LEVELS
  const carriedHeight = args.carriedHeight ?? 0
  const overIndex = flat.findIndex((row) => row.id === overId)
  const activeIndex = flat.findIndex((row) => row.id === activeId)
  const active = flat[activeIndex]
  if (overIndex === -1 || !active) return null

  const moved = arrayMove(flat, activeIndex, overIndex)
  const previous = moved[overIndex - 1]
  const next = moved[overIndex + 1]

  const wanted = active.depth + Math.round(dragOffsetX / indentWidth)
  const deepest = Math.min(previous ? previous.depth + 1 : 0, maxLevels - 1 - carriedHeight)
  const shallowest = next ? next.depth : 0
  // When the row below is deeper than this row may go (it would need to sit
  // past the ceiling to keep that row attached) the ceiling wins.
  const depth = Math.max(0, Math.min(Math.max(wanted, shallowest), deepest))

  return { depth, parentId: parentAt(moved, overIndex, depth) }
}

function parentAt<T extends TreeNode>(
  rows: readonly FlatNode<T>[],
  index: number,
  depth: number,
): string | null {
  const previous = rows[index - 1]
  if (depth === 0 || !previous) return null
  if (depth === previous.depth) return previous.parentId
  if (depth > previous.depth) return previous.id
  const sibling = rows
    .slice(0, index)
    .reverse()
    .find((row) => row.depth === depth)
  return sibling?.parentId ?? null
}

/**
 * Applies a drop: moves the dragged row (and everything it carries) to the
 * target slot at the projected depth, and returns the rebuilt tree.
 */
export function moveNode<T extends TreeNode>(
  items: readonly T[],
  args: { activeId: string; overId: string; projection: Projection },
): T[] {
  const flat = flatten(items)
  const activeIndex = flat.findIndex((row) => row.id === args.activeId)
  const overIndex = flat.findIndex((row) => row.id === args.overId)
  const active = flat[activeIndex]
  if (!active || overIndex === -1) return [...items]
  const updated = flat.map((row) =>
    row.id === args.activeId
      ? { ...row, depth: args.projection.depth, parentId: args.projection.parentId }
      : row,
  )
  return buildTree(arrayMove(updated, activeIndex, overIndex))
}

/** The node with this id anywhere in the tree. */
export function findNode<T extends TreeNode>(items: readonly T[], id: string): T | undefined {
  for (const node of items) {
    if (node.id === id) return node
    const inner = findNode((node.children ?? []) as T[], id)
    if (inner) return inner
  }
  return undefined
}

/** Replaces the node with the same id, keeping its children. */
export function replaceNode<T extends TreeNode>(items: readonly T[], next: T): T[] {
  return items.map((node) => {
    if (node.id === next.id) return { ...next, children: node.children } as T
    if (!node.children?.length) return node
    return { ...node, children: replaceNode(node.children as T[], next) }
  })
}

/** Removes the node and everything below it. */
export function removeNode<T extends TreeNode>(items: readonly T[], id: string): T[] {
  return items
    .filter((node) => node.id !== id)
    .map((node) => {
      if (!node.children?.length) return node
      const children = removeNode(node.children as T[], id)
      return (children.length ? { ...node, children } : withoutChildren(node)) as T
    })
}

/** Appends a node at the top level, or as the last child of `parentId`. */
export function appendNode<T extends TreeNode>(
  items: readonly T[],
  node: T,
  parentId: string | null,
): T[] {
  if (parentId === null) return [...items, node]
  return items.map((current) => {
    if (current.id === parentId) {
      return { ...current, children: [...(current.children ?? []), node] }
    }
    if (!current.children?.length) return current
    return { ...current, children: appendNode(current.children as T[], node, parentId) }
  })
}
