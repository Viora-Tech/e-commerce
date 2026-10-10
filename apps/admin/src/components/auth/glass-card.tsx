import { cn } from '@commerce/ui/lib/utils'
import type { ComponentProps } from 'react'

/** A frosted card for the sign-in panel illustrations. Static and decorative. */
export default function GlassCard({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card/85 p-3.5 shadow-card backdrop-blur-md',
        className,
      )}
      {...props}
    />
  )
}
