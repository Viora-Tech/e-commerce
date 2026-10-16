import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type PageBodyProps = {
  children: ReactNode
  /** Kept for callers; every page fills the panel width now (owner, 2026-10-17: "make all take
      full width"), so the value no longer changes the layout. */
  width?: 'wide' | 'frame' | 'narrow'
  className?: string
}

/** Page frame: padding and the vertical rhythm between header and cards; no max width. */
export default function PageBody({ children, className }: PageBodyProps) {
  return (
    <div
      className={cn(
        /* Saleor rhythm: 24px page inset (16px on phones), 20px between header and cards. */
        'flex w-full flex-col gap-5 px-4 py-5 md:px-6 md:py-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
