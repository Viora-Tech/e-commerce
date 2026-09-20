'use client'

import * as ProgressPrimitive from '@radix-ui/react-progress'
import { motion } from 'motion/react'
import type * as React from 'react'
import { cn } from '../../lib/utils'

interface CustomProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  value?: number
  animationDelay?: number
  color?: string
}

function CustomProgress({
  className,
  value,
  color,
  animationDelay = 0,
  ...props
}: CustomProgressProps) {
  return (
    <ProgressPrimitive.Root
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}
      data-slot="progress"
      style={{
        borderRadius: 'var(--radius-rounded-full, 624.9375rem)',
      }}
      {...props}
    >
      <motion.div
        animate={{ width: `${value || 0}%` }}
        className={cn('h-full flex-1 rounded-full')}
        data-slot="progress-indicator"
        initial={false}
        style={{
          borderRadius: 'inherit',
          background: color
            ? color
            : 'linear-gradient(90deg, var(--background-brand-colors-brand-blue, #5B76DB) 0%, var(--background-brand-colors-brand-purple, #AB82EB) 100%)',
        }}
        transition={{
          duration: 0.3,
          delay: animationDelay,
          ease: [0.4, 0, 0.2, 1],
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { CustomProgress }
