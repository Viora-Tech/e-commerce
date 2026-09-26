'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { fast, instant } from '@/lib/motion'

type AdminTemplateProps = { children: ReactNode }

/**
 * Re-mounts on every navigation: page content fades in with a 4px rise. This is the only
 * page-enter fade in the admin shell (admin-frame.tsx used to have a second, nested one at
 * 220ms; opacity roughly multiplies when two fades stack, so content read as faint for much
 * longer than either duration alone). Kept short (150ms) so real content, not a fade, is what
 * the merchant waits on.
 */
export default function AdminTemplate({ children }: AdminTemplateProps) {
  // Hooks
  const reduced = useReducedMotion()

  // Render logic
  const enter = reduced ? instant : fast

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
      className="min-h-full"
    >
      {children}
    </motion.div>
  )
}
