import { InfoIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import type { ReactNode } from 'react'

type NoticeBarProps = {
  children: ReactNode
  /** Right side, e.g. a small button. */
  action?: ReactNode
  className?: string
}

/**
 * Figma "Notice bar": a quiet hairline strip with an info glyph, for a fact about the whole page.
 * The one banner (`Alert`) in its neutral tone (audit step 10).
 */
export default function NoticeBar({ children, action, className }: NoticeBarProps) {
  return (
    <Alert
      tone="neutral"
      role="note"
      action={action}
      className={cn('items-center py-2.5 *:[svg]:row-span-1 *:[svg]:translate-y-0', className)}
    >
      <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
      <AlertDescription className="text-body">{children}</AlertDescription>
    </Alert>
  )
}
