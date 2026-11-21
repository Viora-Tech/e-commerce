'use client'

import { DragOverlay } from '@dnd-kit/core'
import { useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
 *
 * Portalled to `<body>`. The overlay is `position: fixed` at the row's viewport
 * position, so an ancestor with a transform (the theme editor's tab fade leaves
 * `transform: translateY(0px)`) becomes its containing block and shifts it, and an
 * `overflow: hidden` ancestor (a collapsible group) clips it. dnd-kit then measured
 * the shifted copy for collisions and the parent restriction, so a row in the theme
 * editor's Sections tree could not be dropped where it was dragged. The portal is
 * mounted after hydration, so the server and the first client render agree.
 */
export default function SortableOverlay({ children, className }: SortableOverlayProps) {
  // Hooks
  const prefersReducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Render logic
  const reduced = prefersReducedMotion === true
  const overlay = (
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

  return mounted ? createPortal(overlay, document.body) : overlay
}
