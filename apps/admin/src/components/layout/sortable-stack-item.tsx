'use client'

import { cn } from '@commerce/ui/lib/utils'
import { DragHandle, sortTransition } from '@commerce/ui/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

type SortableStackItemProps = {
  id: string
  handleLabel: string
  scale: number
  reduced: boolean
  className?: string | undefined
  children: (ctx: { handle: ReactNode; isDragging: boolean }) => ReactNode
}

/**
 * One item of a SortableStack: the row itself follows the pointer, its shift divided by the
 * zoom so it stays under the pointer on a scaled canvas. The row lifts its own surface from
 * `isDragging`.
 */
export default function SortableStackItem({
  id,
  handleLabel,
  scale,
  reduced,
  className,
  children,
}: SortableStackItemProps) {
  // Hooks
  const sortable = useSortable({ id, transition: sortTransition(reduced) })

  // Render logic
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = sortable
  const scaled = transform && { ...transform, x: transform.x / scale, y: transform.y / scale }
  const style = { transform: CSS.Translate.toString(scaled), transition }
  const handle = (
    <DragHandle ref={setActivatorNodeRef} label={handleLabel} {...attributes} {...listeners} />
  )

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('relative', sortable.isDragging && 'z-10', className)}
    >
      {children({ handle, isDragging: sortable.isDragging })}
    </li>
  )
}
