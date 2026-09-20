'use client'

import { cn } from '@commerce/ui/lib/utils'

type AdminFloatingSurfaceProps = {
  children: React.ReactNode
  className?: string
}

export function AdminFloatingSurface({ children, className }: AdminFloatingSurfaceProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[16px] border border-border bg-background p-2 shadow-shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}
