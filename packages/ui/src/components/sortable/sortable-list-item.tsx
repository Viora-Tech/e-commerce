'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { ROW_STATE_CLASS } from './classes'
import DragHandle from './drag-handle'
import { sortTransition } from './motion'

type SortableListItemProps = {
  id: string
  handleLabel: string
  reduced: boolean
  className?: string | undefined
  children: (ctx: { handle: ReactNode; isDragging: boolean }) => ReactNode
}

/** One row of a SortableList: the sortable node, with its handle handed to the render prop. */
export default function SortableListItem({
  id,
  handleLabel,
  reduced,
  className,
  children,
}: SortableListItemProps) {
  // Hooks
  const sortable = useSortable({ id, transition: sortTransition(reduced) })

  // Render logic
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = sortable
  const style = { transform: CSS.Translate.toString(transform), transition }
  const handle = (
    <DragHandle ref={setActivatorNodeRef} label={handleLabel} {...attributes} {...listeners} />
  )

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        sortable.isDragging ? ROW_STATE_CLASS.placeholder : ROW_STATE_CLASS.row,
        className,
      )}
    >
      {children({ handle, isDragging: sortable.isDragging })}
    </li>
  )
}
