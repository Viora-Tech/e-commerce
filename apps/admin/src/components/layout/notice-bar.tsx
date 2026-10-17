import { InfoIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type NoticeBarProps = {
  children: ReactNode
  /** Right side, e.g. a small button. */
  action?: ReactNode
  className?: string
}

/** Figma "Notice bar": a quiet hairline strip with an info glyph, for a fact about the whole page. */
export default function NoticeBar({ children, action, className }: NoticeBarProps) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-body text-muted-foreground',
        className,
      )}
    >
      <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{children}</p>
      {action}
    </div>
  )
}
