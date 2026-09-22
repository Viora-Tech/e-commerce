import { cn } from '@commerce/ui/lib/utils'
import type { CSSProperties, ReactNode } from 'react'

type KitTableHeadProps = {
  /** CSS grid template shared with the rows, e.g. `44px 129px 203px 1fr 1fr`. */
  columns: string
  children: ReactNode
  className?: string
}

/** Sheet 14:1007: 56px Aqua Spring band, radius 6, 8px inset, 40px cells with 15/500 Cyprus labels. */
export default function KitTableHead({ columns, children, className }: KitTableHeadProps) {
  // Render logic
  return (
    <div
      style={{ '--kit-cols': columns } as CSSProperties}
      className={cn(
        'grid h-14 items-center gap-4 rounded-md bg-primary-soft p-2 text-kit-head text-ink-strong [grid-template-columns:var(--kit-cols)] [&>*]:flex [&>*]:h-10 [&>*]:items-center [&>*]:px-2.5',
        className,
      )}
    >
      {children}
    </div>
  )
}
