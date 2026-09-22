/**
 * Tree facts the menu validation needs. The drag math and the editing helpers
 * (flatten, projectDrop, moveNode, appendNode...) live beside SortableTree in
 * `@commerce/ui/sortable/tree`; this stays free of React for the server.
 */

/** Anything with an id and optional children: a navigation item, or a test fixture. */
export type TreeNode = { id: string; children?: TreeNode[] | undefined }

/** Top level, dropdown, grouped columns: Shopify's ceiling and ours. */
export const MENU_MAX_LEVELS = 3

/** The deepest level used, 1 for a flat list, 0 for an empty one. */
export function treeLevels(items: readonly TreeNode[]): number {
  let levels = 0
  for (const node of items) levels = Math.max(levels, 1 + treeLevels(node.children ?? []))
  return levels
}

/** Every node, parents before children. */
export function countNodes(items: readonly TreeNode[]): number {
  let n = 0
  for (const node of items) n += 1 + countNodes(node.children ?? [])
  return n
}
