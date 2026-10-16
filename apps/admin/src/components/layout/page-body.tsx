import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type PageBodyProps = {
  children: ReactNode
  /** `wide` for lists (fills the panel, owner 2026-10-17), `frame` for the dashboard (fluid; 5:1346
      is a 1440 artboard, not a cap), `narrow` for forms. */
  width?: 'wide' | 'frame' | 'narrow'
  className?: string
}

/** Page frame: padding, max width, vertical rhythm between header and cards. */
export default function PageBody({ children, width = 'wide', className }: PageBodyProps) {
  return (
    <div
      className={cn(
        /* Saleor rhythm: 24px page inset (16px on phones), 20px between header and cards. */
        'mx-auto flex w-full flex-col gap-5 px-4 py-5 md:px-6 md:py-6',
        width === 'wide' ? 'max-w-none' : width === 'frame' ? 'max-w-none md:mx-0' : 'max-w-5xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
