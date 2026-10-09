'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { base, instant } from '@/lib/motion'

type FloatingBarProps = {
  /** The bar slides in and out as this changes. */
  open: boolean
  children: ReactNode
}

/**
 * The floating bar (Figma "Bar · Floating"): a raised pill at the bottom centre for bulk actions
 * and unsaved changes. It matches the theme (raised surface, hairline), never inverted.
 */
export default function FloatingBar({ open, children }: FloatingBarProps) {
  // Hooks
  const reduced = useReducedMotion()

  // Render logic
  const slide = reduced ? instant : base

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="floating-bar"
          data-save-bar
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={slide}
          className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
        >
          <div
            role="status"
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-hairline bg-raised py-1.5 pr-1.5 pl-4 shadow-popover"
          >
            {children}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
