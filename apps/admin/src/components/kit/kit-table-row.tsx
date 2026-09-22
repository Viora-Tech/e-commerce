import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

type KitTableRowProps = {
  columns: string
  children: ReactNode
  /** Whole row navigates when set (kit rows are static; ours link to the record). */
  href?: string
  className?: string
}

/* Sheet 14:1022: 68px row, 8/12 inset, Neutral/300 hairline below, 15/400 cells, 16px gaps. */
const ROW =
  'grid min-h-[4.25rem] items-center gap-4 border-line border-b px-2 py-3 text-kit-cell text-foreground [grid-template-columns:var(--kit-cols)] [&>*]:flex [&>*]:min-w-0 [&>*]:items-center [&>*]:px-2.5'

export default function KitTableRow({ columns, children, href, className }: KitTableRowProps) {
  // Render logic
  const style = { '--kit-cols': columns } as CSSProperties

  if (href) {
    return (
      <Link
        href={href}
        style={style}
        className={cn(ROW, 'transition-colors hover:bg-background', className)}
      >
        {children}
      </Link>
    )
  }
  return (
    <div style={style} className={cn(ROW, className)}>
      {children}
    </div>
  )
}
