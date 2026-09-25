'use client'

import { motion, useReducedMotion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'
import type { EntranceAnimation } from '../section-settings'
import { shouldAnimateEntrance } from '../section-settings'

type SectionRevealProps = {
  animation: EntranceAnimation
  className?: string | undefined
  children: ReactNode
}

const VARIANTS: Record<Exclude<EntranceAnimation, 'none'>, Variants> = {
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  'slide-up': { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } },
  zoom: { hidden: { opacity: 0, scale: 0.96 }, visible: { opacity: 1, scale: 1 } },
}

/**
 * A section's `advanced.entranceAnimation`, played once with `whileInView`.
 * Reduced motion (OS setting, read by `useReducedMotion`) disables it and
 * renders the section already visible — never a layout shift, since only
 * `opacity`/`transform` animate and the element's box never changes size.
 */
export default function SectionReveal({ animation, className, children }: SectionRevealProps) {
  // Hooks
  const reducedMotion = useReducedMotion()

  // Early returns
  if (!shouldAnimateEntrance(animation, reducedMotion === true)) {
    return <div className={className}>{children}</div>
  }

  // Render logic
  const variant = VARIANTS[animation as Exclude<EntranceAnimation, 'none'>]

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={variant}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
