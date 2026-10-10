import type { SectionGroup, TemplateSection } from '@commerce/core/theme'
import type { PuckAction } from '@puckeditor/core'
import { FOOTER_ZONE, HEADER_ZONE } from './customize-doc'

/**
 * Where a new section goes: a zone of the Customize document and the index it
 * will sit at once inserted (0 = before the first section, `count` = at the
 * end). Every "+" in the editor (the sidebar's "Add section" row, the thin
 * insert line between two rows, and the same line between two sections on
 * the canvas) resolves to one of these, then to the actions below.
 *
 * Plain logic with no JSX, so it sits outside the component-structure rule.
 */
export type InsertTarget = { zone: string; index: number }

/** Header and footer zones only take their own group's sections; the template takes any. */
export function groupForZone(zone: string): SectionGroup | null {
  if (zone === HEADER_ZONE) return 'header'
  if (zone === FOOTER_ZONE) return 'footer'
  return null
}

/** Keeps an insert index inside `0..count`, so a stale target can never throw in Puck. */
export function clampInsertIndex(index: number, count: number): number {
  if (!Number.isFinite(index)) return count
  return Math.min(Math.max(0, Math.trunc(index)), Math.max(0, count))
}

/**
 * The two Puck actions an insert is: put the section at the exact position,
 * then select it, so its settings open on the right. `customize-editor.tsx`'s
 * `revealInserted` scrolls it into view from the same `insert` action.
 */
export function insertActions(
  target: InsertTarget,
  componentType: string,
  count: number,
): PuckAction[] {
  const index = clampInsertIndex(target.index, count)
  return [
    { type: 'insert', componentType, destinationIndex: index, destinationZone: target.zone },
    { type: 'setUi', ui: { itemSelector: { index, zone: target.zone } } },
  ]
}

/** The list after an insert, as Puck's reducer produces it. Mirrors `insert` for tests and previews. */
export function insertAt<T>(list: readonly T[], index: number, item: T): T[] {
  const at = clampInsertIndex(index, list.length)
  return [...list.slice(0, at), item, ...list.slice(at)]
}

/** A section's name in the tree: the merchant's own name (`_name`, set by Rename) or the type's label. */
export function sectionName(section: TemplateSection, label: string): string {
  const custom = section.props._name
  return typeof custom === 'string' && custom.trim() ? custom.trim() : label
}

/** Props after a rename. A blank name (or the type's own label) clears `_name` again. */
export function renamedProps(
  props: TemplateSection['props'],
  name: string,
  label: string,
): TemplateSection['props'] {
  const { _name: _drop, ...rest } = props
  const next = name.trim()
  return next && next !== label ? { ...rest, _name: next } : rest
}

/** The bit of a Puck array field the blocks list needs. */
export type BlockFieldLike = {
  type: string
  label?: string | undefined
  defaultItemProps?:
    | Record<string, unknown>
    | ((index: number) => Record<string, unknown>)
    | undefined
  getItemSummary?: ((item: Record<string, unknown>, index?: number) => string) | undefined
  max?: number | undefined
  min?: number | undefined
  arrayFields?: Record<string, { type: string }> | undefined
}

/** One Shopify "block": an item of one of the section's array fields (a slide, a column, a logo). */
export type SectionBlock = { key: string; index: number; title: string }

/** A section's array fields and their items, in field order. */
export type BlockList = {
  key: string
  label: string
  blocks: SectionBlock[]
  canAdd: boolean
  canRemove: boolean
}

/**
 * The blocks a section holds, read from its top-level `array` fields. Our
 * sections keep repeatable content (slides, columns, logos, FAQ entries) in
 * array fields rather than Puck slots, so these are what the sidebar nests
 * under a section, Shopify-style.
 */
export function sectionBlocks(
  props: Record<string, unknown>,
  fields: Record<string, BlockFieldLike> | undefined,
  fallback: (index: number) => string,
): BlockList[] {
  return Object.entries(fields ?? {})
    .filter(
      // Arrays whose items hold slots (columns, tabs, slides) show as slot zones instead.
      ([, field]) =>
        field.type === 'array' &&
        !Object.values(field.arrayFields ?? {}).some((f) => f.type === 'slot'),
    )
    .map(([key, field]) => {
      const items = Array.isArray(props[key]) ? (props[key] as Record<string, unknown>[]) : []
      // A list filled from store data (a loop) has no blocks of its own to add or remove.
      const linked = props[key] != null && !Array.isArray(props[key])
      return {
        key,
        label: field.label ?? key,
        blocks: items.map((item, index) => ({
          key,
          index,
          title: field.getItemSummary?.(item, index) || fallback(index),
        })),
        canAdd: !linked && (field.max === undefined || items.length < field.max),
        canRemove: !linked && items.length > (field.min ?? 0),
      }
    })
}

/** Props with one more block at the end of array field `key`, from the field's own defaults. */
export function withBlockAdded(
  props: Record<string, unknown>,
  key: string,
  field: BlockFieldLike,
): Record<string, unknown> {
  const items = Array.isArray(props[key]) ? (props[key] as Record<string, unknown>[]) : []
  const defaults =
    typeof field.defaultItemProps === 'function'
      ? field.defaultItemProps(items.length)
      : (field.defaultItemProps ?? {})
  return { ...props, [key]: [...items, { ...defaults }] }
}

/** Props without block `index` of array field `key`. */
export function withBlockRemoved(
  props: Record<string, unknown>,
  key: string,
  index: number,
): Record<string, unknown> {
  const items = Array.isArray(props[key]) ? (props[key] as Record<string, unknown>[]) : []
  return { ...props, [key]: items.filter((_, i) => i !== index) }
}

/** A section's vertical extent on the canvas, in the preview's viewport pixels. */
export type SectionBox = { id: string; top: number; bottom: number }

/** The section edge the pointer is near: the "+" there inserts before (`top`) or after it. */
export type CanvasEdge = { id: string; side: 'top' | 'bottom'; y: number }

/**
 * Which section edge the pointer at `y` is within `band` pixels of, for the
 * canvas insert line. Inside a section only its own edges count (so the line
 * never jumps into the middle of one); in a gap between sections the closest
 * edge wins.
 */
export function edgeNear(boxes: readonly SectionBox[], y: number, band: number): CanvasEdge | null {
  const inside = boxes.find((b) => y >= b.top && y <= b.bottom)
  if (inside) {
    if (y - inside.top <= band) return { id: inside.id, side: 'top', y: inside.top }
    if (inside.bottom - y <= band) return { id: inside.id, side: 'bottom', y: inside.bottom }
    return null
  }
  let best: CanvasEdge | null = null
  let bestDistance = band
  for (const b of boxes) {
    for (const edge of [
      { id: b.id, side: 'top' as const, y: b.top },
      { id: b.id, side: 'bottom' as const, y: b.bottom },
    ]) {
      const distance = Math.abs(edge.y - y)
      if (distance <= bestDistance) {
        best = edge
        bestDistance = distance
      }
    }
  }
  return best
}

/** The insert position an edge stands for, given where its section sits. */
export function targetForEdge(
  edge: Pick<CanvasEdge, 'side'>,
  located: { zone: string; index: number },
): InsertTarget {
  return { zone: located.zone, index: edge.side === 'top' ? located.index : located.index + 1 }
}
