'use client'

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  MeasuringStrategy,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useReducedMotion } from 'motion/react'
import { Fragment, type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react'
import DragHandle from './drag-handle'
import SortableOverlay from './sortable-overlay'
import SortableTreeRow from './sortable-tree-row'
import {
  countDescendants,
  flatten,
  moveNode,
  type Projection,
  projectDrop,
  subtreeHeight,
  TREE_MAX_LEVELS,
  type TreeNode,
} from './tree'
import { KEY_MOVES, keyboardMove, placement, visibleRows } from './tree-keyboard'
import type { SortableTreeLabels, SortableTreeRowContext } from './types'
import { useDndSensors } from './use-dnd-sensors'

type Item<T> = Omit<T, 'children'>

type SortableTreeProps<T extends TreeNode> = {
  items: T[]
  onChange: (items: T[]) => void
  getTitle: (item: Item<T>) => string
  labels: SortableTreeLabels
  /** One row's contents; `ctx.depth` is the level to indent to, `ctx.handle` the grip. */
  renderRow: (ctx: SortableTreeRowContext<Item<T>>) => ReactNode
  /** List items to render after an expanded parent's last child, e.g. "Add item to Shop". */
  renderAfterGroup?: (parent: { id: string; item: Item<T>; depth: number }) => ReactNode
  maxLevels?: number
  /** Sideways travel per level, in rem; match the row indentation. */
  indentRem?: number
}

type Lifted<T> = { id: string; snapshot: T[] }

function rootFontPx(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/**
 * A nestable sortable (dnd-kit's SortableTree, the way Shopify's menu editor
 * feels): drag vertically to reorder, sideways to change level; a parent carries
 * its children. From the keyboard, space picks a row up, arrows move and nest it,
 * space drops and escape puts it back. Every step is announced.
 */
export default function SortableTree<T extends TreeNode>({
  items,
  onChange,
  getTitle,
  labels,
  renderRow,
  renderAfterGroup,
  maxLevels = TREE_MAX_LEVELS,
  indentRem = 2,
}: SortableTreeProps<T>) {
  // Hooks
  const prefersReducedMotion = useReducedMotion()
  const sensors = useDndSensors({ keyboard: false })
  /* A stable id keeps dnd-kit's aria-describedby the same on the server and the client. */
  const dndId = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [lifted, setLifted] = useState<Lifted<T> | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const indentPx = useRef(indentRem * 16)

  // Helpers
  const projectionFor = (active: string | null, over: string | null): Projection | null => {
    if (!active || !over) return null
    return projectDrop({
      flat: visibleRows(items, [active, ...collapsed]),
      activeId: active,
      overId: over,
      dragOffsetX: offsetLeft,
      indentWidth: indentPx.current,
      maxLevels,
      carriedHeight: subtreeHeight(flatten(items), active),
    })
  }

  const describe = (tree: T[], id: string, verb: 'position' | 'dropped') => {
    const at = placement(tree, id, collapsed)
    return at ? labels[verb](getTitle(at.item), at.position, at.total, at.level) : ''
  }

  const titleOf = (id: unknown) => {
    const row = flatten(items).find((r) => r.id === id)
    return row ? getTitle(row.item) : ''
  }

  /** Where a pointer drag will land, as an announcement: position among the rows and level. */
  const landing = (active: unknown, over: unknown, verb: 'position' | 'dropped') => {
    if (over === null || over === undefined) return ''
    const around = visibleRows(items, [String(active), ...collapsed])
    const level = (projectionFor(String(active), String(over))?.depth ?? 0) + 1
    const position = around.findIndex((r) => r.id === over) + 1
    return labels[verb](titleOf(active), position, around.length, level)
  }

  const resetDrag = () => {
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
    document.body.style.removeProperty('cursor')
  }

  const refocus = (id: string) => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-grip="${id}"]`)?.focus()
    })
  }

  // Event handlers
  const handleDragStart = ({ active }: DragStartEvent) => {
    indentPx.current = indentRem * rootFontPx()
    setLifted(null)
    setActiveId(String(active.id))
    setOverId(String(active.id))
    setOffsetLeft(0)
    document.body.style.setProperty('cursor', 'grabbing')
  }

  const handleDragMove = ({ delta }: DragMoveEvent) => setOffsetLeft(delta.x)

  const handleDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const projection = projectionFor(String(active.id), over ? String(over.id) : null)
    resetDrag()
    if (!projection || !over) return
    onChange(moveNode(items, { activeId: String(active.id), overId: String(over.id), projection }))
  }

  const handleToggle = (id: string) => {
    setCollapsed((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  const handleKeyDown = (id: string, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (lifted?.id === id) {
        setLifted(null)
        setAnnouncement(describe(items, id, 'dropped'))
        return
      }
      setLifted({ id, snapshot: items })
      setAnnouncement(`${labels.picked(titleOf(id))} ${describe(items, id, 'position')}`)
      return
    }
    if (lifted?.id !== id) return
    if (event.key === 'Escape') {
      event.preventDefault()
      onChange(lifted.snapshot)
      setLifted(null)
      setAnnouncement(labels.cancelled(titleOf(id)))
      refocus(id)
      return
    }
    const move = KEY_MOVES[event.key]
    if (!move) return
    event.preventDefault()
    const next = keyboardMove(items, id, move, { collapsed, maxLevels })
    if (!next) {
      setAnnouncement(describe(items, id, 'position'))
      return
    }
    onChange(next)
    setAnnouncement(describe(next, id, 'position'))
    refocus(id)
  }

  const handleBlur = (id: string, next: Element | null) => {
    // A row moving in the DOM blurs its handle with nowhere to go (next is
    // null) and refocus puts it back; only a real move away drops the row.
    if (lifted?.id === id && next !== null) setLifted(null)
  }

  // Render logic
  const reduced = prefersReducedMotion === true
  const flat = flatten(items)
  const rows = visibleRows(items, activeId ? [activeId, ...collapsed] : collapsed)
  const projected = projectionFor(activeId, overId)
  const activeRow = activeId ? flat.find((row) => row.id === activeId) : undefined
  const groupEnds = new Map<string, { id: string; item: Item<T>; depth: number }[]>()
  if (!activeId && renderAfterGroup) {
    rows.forEach((row, i) => {
      if (row.depth > maxLevels - 2 || collapsed.includes(row.id)) return
      if (countDescendants(flat, row.id) === 0) return
      let last = i
      while ((rows[last + 1]?.depth ?? -1) > row.depth) last++
      const key = rows[last]?.id as string
      groupEnds.set(key, [
        { id: row.id, item: row.item, depth: row.depth },
        ...(groupEnds.get(key) ?? []),
      ])
    })
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => labels.picked(titleOf(active.id)),
    onDragOver: ({ active, over }) => landing(active.id, over?.id, 'position'),
    onDragEnd: ({ active, over }) => landing(active.id, over?.id, 'dropped'),
    onDragCancel: ({ active }) => labels.cancelled(titleOf(active.id)),
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: labels.instructions },
      }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDrag}
    >
      <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
        <ul>
          {rows.map((row) => {
            const isActive = row.id === activeId
            const state = isActive ? 'placeholder' : lifted?.id === row.id ? 'lifted' : 'row'
            return [
              <SortableTreeRow
                key={row.id}
                id={row.id}
                state={state}
                handleLabel={labels.handle(getTitle(row.item))}
                reduced={reduced}
                onHandleKeyDown={(event) => handleKeyDown(row.id, event)}
                onHandleBlur={(next) => handleBlur(row.id, next)}
              >
                {(handle) =>
                  renderRow({
                    item: row.item,
                    depth: isActive && projected ? projected.depth : row.depth,
                    state,
                    hasChildren: countDescendants(flat, row.id) > 0,
                    collapsed: collapsed.includes(row.id),
                    carried: 0,
                    handle,
                    onToggle: () => handleToggle(row.id),
                  })
                }
              </SortableTreeRow>,
              ...(groupEnds.get(row.id) ?? []).map((parent) => (
                <Fragment key={`after-${parent.id}`}>{renderAfterGroup?.(parent)}</Fragment>
              )),
            ]
          })}
        </ul>
      </SortableContext>
      <SortableOverlay>
        {activeRow
          ? renderRow({
              item: activeRow.item,
              depth: 0,
              state: 'overlay',
              hasChildren: false,
              collapsed: false,
              carried: countDescendants(flat, activeRow.id),
              handle: <DragHandle label={labels.handle(getTitle(activeRow.item))} tabIndex={-1} />,
              onToggle: () => {},
            })
          : null}
      </SortableOverlay>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </DndContext>
  )
}
