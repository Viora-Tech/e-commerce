import { TriangleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type InlineWarningProps = {
  children: ReactNode
  className?: string
}

/**
 * A warning under the setting that causes it, drawn like the page's delivery warnings but
 * smaller: e.g. "Fastest" plus "Hide slower and dearer" (#1781).
 */
export default function InlineWarning({ children, className }: InlineWarningProps) {
  // Render logic
  return (
    <p
      role="note"
      className={cn(
        'flex items-start gap-2 rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-caption text-ink-strong',
        className,
      )}
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <span>{children}</span>
    </p>
  )
}
