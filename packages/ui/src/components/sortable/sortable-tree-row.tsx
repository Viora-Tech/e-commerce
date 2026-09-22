'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { ROW_STATE_CLASS } from './classes'
import DragHandle from './drag-handle'
import { sortTransition } from './motion'
import type { SortableRowState } from './types'

type SortableTreeRowProps = {
  id: string
  state: Exclude<SortableRowState, 'overlay'>
  handleLabel: string
  reduced: boolean
  onHandleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onHandleBlur: (next: Element | null) => void
  children: (handle: ReactNode) => ReactNode
}

/** One SortableTree row: the sortable node, its handle carrying the pointer listeners and the keyboard lift. */
export default function SortableTreeRow({
  id,
  state,
  handleLabel,
  reduced,
  onHandleKeyDown,
  onHandleBlur,
  children,
}: SortableTreeRowProps) {
  // Hooks
  const sortable = useSortable({ id, transition: sortTransition(reduced) })

  // Render logic
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = sortable
  const style = { transform: CSS.Translate.toString(transform), transition }
  const handle = (
    <DragHandle
      ref={setActivatorNodeRef}
      data-grip={id}
      label={handleLabel}
      lifted={state === 'lifted'}
      {...attributes}
      {...listeners}
      aria-pressed={state === 'lifted'}
      onKeyDown={onHandleKeyDown}
      onBlur={(event) => onHandleBlur(event.relatedTarget as Element | null)}
    />
  )

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('relative border-b border-line last:border-b-0', ROW_STATE_CLASS[state])}
    >
      {children(handle)}
    </li>
  )
}
