'use client'

import type { ComponentProps } from 'react'
import { GripVertical } from '../../icons'
import { cn } from '../../lib/utils'

type DragHandleProps = ComponentProps<'button'> & {
  /** What the handle moves, for screen readers ("Move Shop"). */
  label: string
  /** Picked up from the keyboard and waiting for arrows. */
  lifted?: boolean
}

/**
 * The grip every sortable row drags by. Spread the sortable `attributes` and
 * `listeners` onto it and pass `setActivatorNodeRef` as its ref, so only the
 * grip starts a drag and the rest of the row stays clickable.
 */
export default function DragHandle({
  label,
  lifted = false,
  className,
  ...props
}: DragHandleProps) {
  // Render logic
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground',
        'cursor-grab hover:bg-muted hover:text-foreground active:cursor-grabbing',
        'focus-visible:outline-2 focus-visible:outline-ring',
        lifted &&
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <GripVertical className="size-4" />
    </button>
  )
}
