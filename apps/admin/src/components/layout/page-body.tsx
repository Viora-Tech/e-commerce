import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type PageBodyProps = {
  children: ReactNode
  /** `wide` for lists, `frame` for the dashboard (fluid; 5:1346 is a 1440 artboard, not a cap), `narrow` for forms. */
  width?: 'wide' | 'frame' | 'narrow'
  className?: string
}

/** Page frame: padding, max width, vertical rhythm between header and cards. */
export default function PageBody({ children, width = 'wide', className }: PageBodyProps) {
  return (
    <div
      className={cn(
        /* Frame 5:1346: content starts 20px in from the rail and 20px under the bar, 44px from the right edge. */
        'mx-auto flex w-full flex-col gap-4 p-4 md:py-4 md:pl-5 md:pr-6',
        width === 'wide'
          ? 'max-w-[90rem]'
          : width === 'frame'
            ? 'max-w-none md:mx-0 md:pl-5 md:pr-5'
            : 'max-w-5xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
