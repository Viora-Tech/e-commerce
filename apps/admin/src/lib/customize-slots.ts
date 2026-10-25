import { richtextFromLexical } from '@commerce/blocks/puck'
import type { TemplateSection } from '@commerce/core/theme'
import { instantiateCustomSection } from '@commerce/core/theme'
import type { PuckAction } from '@puckeditor/core'
import {
  type CustomizeDoc,
  FOOTER_ZONE,
  HEADER_ZONE,
  MAIN_ZONE,
  zoneSections,
} from './customize-doc'
import { clampInsertIndex, type InsertTarget } from './customize-insert'

/**
 * Slots in the Customize tree: a container's drop zones (a Group's content,
 * each column, each tab) and the blocks in them, read straight from the Puck
 * document. A slot zone is named as Puck names it, `<parentId>:<propPath>`,
 * where the path runs through array items (`columns[1].content`), so every
 * tree action is a plain Puck action on that zone and undo covers it.
 *
 * Plain logic with no JSX, so it sits outside the component-structure rule.
 */

type FieldLike = {
  type: string
  label?: string | undefined
  arrayFields?: Record<string, FieldLike> | undefined
  objectFields?: Record<string, FieldLike> | undefined
  getItemSummary?: ((item: Record<string, unknown>, index?: number) => string) | undefined
}

/** One slot of a block, as the tree lists it. */
export type SlotZone = {
  /** Puck's zone name: `<parentId>:<propPath>`. */
  zone: string
  propPath: string
  /** What the tree calls it: the slot's label, or its array item's summary ("Column 2"). */
  label: string
  items: TemplateSection[]
}

const blocksIn = (value: unknown): TemplateSection[] =>
  Array.isArray(value) ? (value as TemplateSection[]) : []

/**
 * Every slot of a block, in field order: top-level slot fields, then slots
 * inside each array item (columns, tabs, slides) and inside object fields.
 */
export function slotZones(
  props: Record<string, unknown>,
  fields: Record<string, FieldLike> | undefined,
): SlotZone[] {
  const id = String(props.id ?? '')
  const out: SlotZone[] = []
  const visit = (
    value: Record<string, unknown>,
    fieldMap: Record<string, FieldLike>,
    prefix: string,
    itemLabel: string | null,
  ) => {
    for (const [key, field] of Object.entries(fieldMap)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (field.type === 'slot') {
        out.push({
          zone: `${id}:${path}`,
          propPath: path,
          label: itemLabel ?? field.label ?? key,
          items: blocksIn(value[key]),
        })
      } else if (field.type === 'array' && field.arrayFields && Array.isArray(value[key])) {
        ;(value[key] as Record<string, unknown>[]).forEach((item, i) => {
          const summary = field.getItemSummary?.(item ?? {}, i) || `${field.label ?? key} ${i + 1}`
          visit(item ?? {}, field.arrayFields ?? {}, `${path}[${i}]`, summary)
        })
      } else if (field.type === 'object' && field.objectFields && value[key]) {
        visit(value[key] as Record<string, unknown>, field.objectFields, path, itemLabel)
      }
    }
  }
  visit(props, fields ?? {}, '', null)
  return out
}

/** Whether a block has any slot at all (so the tree gives it a disclosure). */
export const hasSlots = (fields: Record<string, FieldLike> | undefined): boolean =>
  Object.values(fields ?? {}).some(
    (f) =>
      f.type === 'slot' ||
      (f.type === 'array' && Object.values(f.arrayFields ?? {}).some((s) => s.type === 'slot')),
  )

/** `columns[1].content` → `['columns', 1, 'content']`. */
export function parsePropPath(path: string): (string | number)[] {
  return path
    .split('.')
    .flatMap((part) =>
      [...part.matchAll(/([^[\]]+)|\[(\d+)\]/g)].map((m) =>
        m[2] ? Number(m[2]) : (m[1] as string),
      ),
    )
}

const ROOT_ZONES = [MAIN_ZONE, HEADER_ZONE, FOOTER_ZONE]

/** Is this one of the document's own zones (template, header, footer), not a slot? */
export const isRootZone = (zone: string) => ROOT_ZONES.includes(zone)

/**
 * Calls `fn` for every block in the document, at every depth, with where it sits; returning
 * true stops the walk.
 */
export function eachBlock(
  doc: CustomizeDoc,
  fn: (block: TemplateSection, zone: string, index: number) => boolean | undefined,
): void {
  const visitValue = (value: unknown, parentId: string, path: string): boolean => {
    if (Array.isArray(value)) {
      const blocks = value.every(
        (v) => v && typeof v === 'object' && typeof (v as TemplateSection).type === 'string',
      )
      if (blocks && value.length > 0) {
        for (const [i, block] of (value as TemplateSection[]).entries()) {
          if (visitBlock(block, `${parentId}:${path}`, i)) return true
        }
        return false
      }
      for (const [i, v] of value.entries()) {
        if (visitValue(v, parentId, `${path}[${i}]`)) return true
      }
      return false
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (visitValue(v, parentId, path ? `${path}.${k}` : k)) return true
      }
    }
    return false
  }
  const visitBlock = (block: TemplateSection, zone: string, index: number): boolean => {
    if (fn(block, zone, index)) return true
    const id = String(block.props?.id ?? '')
    for (const [k, v] of Object.entries(block.props ?? {})) {
      if (k === 'id') continue
      if (visitValue(v, id, k)) return true
    }
    return false
  }
  for (const zone of ROOT_ZONES) {
    for (const [i, block] of zoneSections(doc, zone).entries()) {
      if (visitBlock(block, zone, i)) return
    }
  }
}

/** Where a block sits (its zone and index), at any depth; null when it isn't in the document. */
export function locateBlock(doc: CustomizeDoc, id: string): { zone: string; index: number } | null {
  let found: { zone: string; index: number } | null = null
  eachBlock(doc, (block, zone, index) => {
    if (block.props?.id !== id) return false
    found = { zone, index }
    return true
  })
  return found
}

/** A block by id, at any depth. */
export function findBlock(doc: CustomizeDoc, id: string): TemplateSection | null {
  let found: TemplateSection | null = null
  eachBlock(doc, (block) => {
    if (block.props?.id !== id) return false
    found = block
    return true
  })
  return found
}

/** The blocks in a zone: a root zone, or a slot (`<parentId>:<propPath>`). */
export function zoneItems(doc: CustomizeDoc, zone: string): TemplateSection[] {
  if (isRootZone(zone)) return zoneSections(doc, zone)
  const at = zone.indexOf(':')
  if (at < 0) return []
  const parent = findBlock(doc, zone.slice(0, at))
  if (!parent) return []
  let value: unknown = parent.props
  for (const key of parsePropPath(zone.slice(at + 1))) {
    if (value === null || typeof value !== 'object') return []
    value = (value as Record<string | number, unknown>)[key]
  }
  return blocksIn(value)
}

/** The block a slot zone belongs to, and where that block sits; null for root zones. */
export function slotOwner(
  doc: CustomizeDoc,
  zone: string,
): { id: string; zone: string; index: number } | null {
  if (isRootZone(zone)) return null
  const id = zone.slice(0, zone.indexOf(':'))
  const located = locateBlock(doc, id)
  return located ? { id, ...located } : null
}

/** Where a single drag moved one row, from the list before and after it. */
export function movedIndexes(
  before: string[],
  after: string[],
): { from: number; to: number } | null {
  const first = before.findIndex((id, i) => id !== after[i])
  if (first === -1) return null
  let last = before.length - 1
  while (last > first && before[last] === after[last]) last--
  return after[first] === before[last] ? { from: last, to: first } : { from: first, to: last }
}

/** The Puck actions for a tree drag inside one zone (root or slot): reorder, then keep it selected. */
export function reorderActions(zone: string, before: string[], after: string[]): PuckAction[] {
  const moved = movedIndexes(before, after)
  if (!moved) return []
  return [
    { type: 'reorder', sourceIndex: moved.from, destinationIndex: moved.to, destinationZone: zone },
    { type: 'setUi', ui: { itemSelector: { index: moved.to, zone } } },
  ]
}

/** Keyboard "move up/down": the same reorder, one step, clamped to the zone. */
export function stepActions(
  zone: string,
  index: number,
  count: number,
  step: -1 | 1,
): PuckAction[] {
  const to = index + step
  if (to < 0 || to >= count) return []
  return [
    { type: 'reorder', sourceIndex: index, destinationIndex: to, destinationZone: zone },
    { type: 'setUi', ui: { itemSelector: { index: to, zone } } },
  ]
}

/** "Move out of <container>": the block goes right after its container, in the container's zone. */
export function moveOutActions(doc: CustomizeDoc, zone: string, index: number): PuckAction[] {
  const owner = slotOwner(doc, zone)
  if (!owner) return []
  const destinationIndex = owner.index + 1
  return [
    {
      type: 'move',
      sourceIndex: index,
      sourceZone: zone,
      destinationIndex,
      destinationZone: owner.zone,
    },
    { type: 'setUi', ui: { itemSelector: { index: destinationIndex, zone: owner.zone } } },
  ]
}

/**
 * Put a copy of a whole block (children and all, every id fresh) at a
 * position: an `insert` of its type (not recorded), then a `replace` with the
 * copy's data, so undo sees one step. Used by paste and by "My sections".
 */
export function insertCopyActions(
  target: InsertTarget,
  block: TemplateSection,
  count: number,
  makeId?: (type: string) => string,
): PuckAction[] {
  // A section saved before the Lexical field was retired carries Lexical JSON; Puck's
  // richtext field edits HTML (see `normalizeDoc`).
  const copy = richtextFromLexical(instantiateCustomSection(block, makeId)) as TemplateSection
  const index = clampInsertIndex(target.index, count)
  return [
    {
      type: 'insert',
      componentType: copy.type,
      destinationIndex: index,
      destinationZone: target.zone,
      id: copy.props.id,
      recordHistory: false,
    },
    { type: 'replace', destinationIndex: index, destinationZone: target.zone, data: copy },
    { type: 'setUi', ui: { itemSelector: { index, zone: target.zone } } },
  ]
}
