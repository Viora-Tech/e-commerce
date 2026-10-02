'use client'

import { TooltipProvider } from '@commerce/ui/shadcn/tooltip'
import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

type MotionProviderProps = {
  children: ReactNode
}

/**
 * One place for app-wide motion behaviour (docs/conventions.md, "Motion"):
 * - Motion components follow the OS "reduce motion" setting: transforms and layout
 *   animations are skipped, opacity still fades.
 * - Every tooltip shares one provider, so once a tooltip is open the next one opens
 *   instantly, with no delay and no animation (Base UI's data-instant).
 */
export default function MotionProvider({ children }: MotionProviderProps) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>{children}</TooltipProvider>
    </MotionConfig>
  )
}
