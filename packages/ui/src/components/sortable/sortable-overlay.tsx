'use client'

import { DragOverlay } from '@dnd-kit/core'
import { useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { dropAnimation } from './motion'

type SortableOverlayProps = {
  /** The row under the pointer: render the same content as the list row. */
  children: ReactNode
  className?: string
}

/**
 * The lifted copy that follows the pointer: the kit popover shadow, a slight
 * scale, and the shared drop animation. Every sortable renders its overlay here.
 */
export default function SortableOverlay({ children, className }: SortableOverlayProps) {
  // Hooks
  const prefersReducedMotion = useReducedMotion()

  // Render logic
  const reduced = prefersReducedMotion === true

  return (
    <DragOverlay dropAnimation={dropAnimation(reduced)}>
      {children ? (
        <div
          className={cn(
            'cursor-grabbing overflow-hidden rounded-lg border border-line bg-card shadow-popover',
            !reduced && 'scale-[1.02]',
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </DragOverlay>
  )
}
