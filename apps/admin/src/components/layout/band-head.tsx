import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type BandHeadProps = { children: ReactNode; className?: string }

/** 5:2146: 48px tinted header band, 8px radius, 13px uppercase labels, 20px cell inset. */
export default function BandHead({ children, className }: BandHeadProps) {
  return (
    <div
      className={cn(
        'grid h-12 items-center rounded-lg bg-primary-soft px-5 text-kit-body font-medium uppercase text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
