'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import type { ReactNode } from 'react'

type MetricLabelProps = {
  children: ReactNode
  /** What the metric means, shown on hover or focus. */
  help: string
  className?: string
}

/** Shopify's metric label: a dotted underline that opens the metric's definition. */
export default function MetricLabel({ children, help, className }: MetricLabelProps) {
  // Render logic
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the definition must open from the keyboard too
            tabIndex={0}
            className={cn(
              'w-fit cursor-help underline decoration-muted-foreground decoration-dotted underline-offset-4 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{help}</TooltipContent>
    </Tooltip>
  )
}
