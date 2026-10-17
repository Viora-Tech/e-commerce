'use client'

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useReducedMotion } from 'motion/react'
import { type ReactNode, useId, useState } from 'react'
import DragHandle from './drag-handle'
import SortableListItem from './sortable-list-item'
import SortableOverlay from './sortable-overlay'
import type { SortableListLabels } from './types'
import { useDndSensors } from './use-dnd-sensors'

type SortableListProps<T extends { id: string }> = {
  items: T[]
  onReorder: (items: T[]) => void
  /** The item's name, for the handle label and announcements. */
  getTitle: (item: T) => string
  labels: SortableListLabels
  /** One row's contents; put `handle` where the grip belongs. */
  renderItem: (item: T, ctx: { handle: ReactNode; isDragging: boolean }) => ReactNode
  className?: string
  itemClassName?: string
}

const MODIFIERS = [restrictToVerticalAxis, restrictToParentElement]

/**
 * A vertical list reordered by dragging a grip (mouse, touch or keyboard), with
 * the shared overlay, timing and announcements. Product media, variant options,
 * collection products and table rows all sort through this.
 */
export default function SortableList<T extends { id: string }>({
  items,
  onReorder,
  getTitle,
  labels,
  renderItem,
  className,
  itemClassName,
}: SortableListProps<T>) {
  // Hooks
  const prefersReducedMotion = useReducedMotion()
  const sensors = useDndSensors()
  /* A stable id keeps dnd-kit's aria-describedby the same on the server and the client. */
  const dndId = useId()
  const [activeId, setActiveId] = useState<string | null>(null)

  // Helpers
  const titleOf = (id: unknown) => {
    const item = items.find((i) => i.id === id)
    return item ? getTitle(item) : ''
  }

  const positionOf = (id: unknown) => items.findIndex((i) => i.id === id) + 1

  // Event handlers
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    if (from === -1 || to === -1) return
    onReorder(arrayMove(items, from, to))
  }

  // Render logic
  const reduced = prefersReducedMotion === true
  const active = activeId ? items.find((i) => i.id === activeId) : undefined
  const total = items.length
  const announcements: Announcements = {
    onDragStart: (e) => labels.picked(titleOf(e.active.id)),
    onDragOver: (e) =>
      e.over ? labels.moved(titleOf(e.active.id), positionOf(e.over.id), total) : '',
    onDragEnd: (e) =>
      e.over ? labels.dropped(titleOf(e.active.id), positionOf(e.over.id), total) : '',
    onDragCancel: (e) => labels.cancelled(titleOf(e.active.id)),
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={MODIFIERS}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: labels.instructions },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item) => (
            <SortableListItem
              key={item.id}
              id={item.id}
              handleLabel={labels.handle(getTitle(item))}
              reduced={reduced}
              className={itemClassName}
            >
              {(ctx) => renderItem(item, ctx)}
            </SortableListItem>
          ))}
        </ul>
      </SortableContext>
      <SortableOverlay>
        {active
          ? renderItem(active, {
              handle: <DragHandle label={labels.handle(getTitle(active))} tabIndex={-1} />,
              isDragging: false,
            })
          : null}
      </SortableOverlay>
    </DndContext>
  )
}
