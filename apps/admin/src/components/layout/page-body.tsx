import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type PageBodyProps = {
  children: ReactNode
  /** `wide` for lists and dashboards, `narrow` for forms. */
  width?: 'wide' | 'narrow'
  className?: string
}

/** Page frame: padding, max width, vertical rhythm between header and cards. */
export function PageBody({ children, width = 'wide', className }: PageBodyProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-6 p-4 md:p-6',
        width === 'wide' ? 'max-w-7xl' : 'max-w-5xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

type PageColumnsProps = {
  main: ReactNode
  side?: ReactNode
}

/** Two-column layout: main content plus a narrower side rail (status, organisation…). */
export function PageColumns({ main, side }: PageColumnsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">{main}</div>
      {side ? <div className="flex min-w-0 flex-col gap-6">{side}</div> : null}
    </div>
  )
}
