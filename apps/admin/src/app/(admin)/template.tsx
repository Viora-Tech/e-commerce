'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { base, instant } from '@/lib/motion'

type AdminTemplateProps = { children: ReactNode }

/** Re-mounts on every navigation: page content fades in with a 4px rise. */
export default function AdminTemplate({ children }: AdminTemplateProps) {
  // Hooks
  const reduced = useReducedMotion()

  // Render logic
  const enter = reduced ? instant : base

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
