'use client'

import { type SortableListLabels, useDndSensors } from '@commerce/ui/sortable'
import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useReducedMotion } from 'motion/react'
import { type ReactNode, useId } from 'react'
import SortableStackItem from './sortable-stack-item'

type SortableStackProps<T extends { id: string }> = {
  items: T[]
  onReorder: (items: T[]) => void
  /** The item's name, for the handle label and announcements. */
  getTitle: (item: T) => string
  labels: SortableListLabels
  /** One item's contents; put `handle` where the grip belongs. */
  renderItem: (item: T, ctx: { handle: ReactNode; isDragging: boolean }) => ReactNode
  /** The zoom of a scaled canvas the stack sits in (1 when unscaled). */
  scale?: number | undefined
  className?: string | undefined
  itemClassName?: string | undefined
}

/** Items only move up and down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * SortableList's sensors, timing and announcements, with the row itself following the pointer
 * instead of a floating copy. For lists inside a dialog or on a zoomed canvas, where a fixed
 * overlay would be placed against the transformed parent rather than the screen.
 */
export default function SortableStack<T extends { id: string }>({
  items,
  onReorder,
  getTitle,
  labels,
  renderItem,
  scale = 1,
  className,
  itemClassName,
}: SortableStackProps<T>) {
  // Hooks
  const sensors = useDndSensors()
  const prefersReducedMotion = useReducedMotion()
  /* A stable id keeps dnd-kit's aria-describedby the same on the server and the client. */
  const dndId = useId()

  // Helpers
  const titleOf = (id: unknown) => {
    const item = items.find((i) => i.id === id)
    return item ? getTitle(item) : ''
  }

  const positionOf = (id: unknown) => items.findIndex((i) => i.id === id) + 1

  // Event handlers
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    if (from === -1 || to === -1) return
    onReorder(arrayMove(items, from, to))
  }

  // Render logic
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
      modifiers={[verticalOnly]}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: labels.instructions },
      }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item) => (
            <SortableStackItem
              key={item.id}
              id={item.id}
              handleLabel={labels.handle(getTitle(item))}
              scale={scale}
              reduced={prefersReducedMotion === true}
              className={itemClassName}
            >
              {(ctx) => renderItem(item, ctx)}
            </SortableStackItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
