'use client'

import { DragOverlay } from '@dnd-kit/core'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import {
  IMAGE_LIFT_SCALE,
  IMAGE_LIFT_SPRING,
  IMAGE_LIFT_TILT_DEG,
  LIFT_FRAME_ATTR,
  LIFT_SHADOW_ATTR,
} from '@/hooks/use-image-dnd'

type ImageDragOverlayProps = {
  reduced: boolean
  dropAnimation: Parameters<typeof DragOverlay>[0]['dropAnimation']
  /** The picked-up tile's picture; absent when nothing is being dragged. */
  children: ReactNode
}

/**
 * The picked-up image: lifts with a spring (scale and a slight tilt), a soft shadow fades in
 * on its own layer (opacity only), and it floats above scroll containers. On drop the shared
 * `useImageDnd` animation settles it into its slot.
 */
export default function ImageDragOverlay({
  reduced,
  dropAnimation,
  children,
}: ImageDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={dropAnimation} zIndex={60}>
      {children ? (
        <motion.div
          {...{ [LIFT_FRAME_ATTR]: '' }}
          initial={reduced ? false : { scale: 1, rotate: 0 }}
          animate={reduced ? undefined : { scale: IMAGE_LIFT_SCALE, rotate: IMAGE_LIFT_TILT_DEG }}
          transition={IMAGE_LIFT_SPRING}
          className="relative size-full cursor-grabbing"
        >
          {reduced ? null : (
            <motion.span
              {...{ [LIFT_SHADOW_ATTR]: '' }}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 rounded-lg shadow-popover"
            />
          )}
          <div className="relative size-full overflow-hidden rounded-lg border border-line bg-card">
            {children}
          </div>
        </motion.div>
      ) : null}
    </DragOverlay>
  )
}
