import { cn } from '@commerce/ui/lib/utils'

export type StatusTone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

type StatusPillProps = {
  tone: StatusTone
  children: string
  className?: string
}

const DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-link',
  neutral: 'bg-muted-foreground-soft',
}

const TEXT: Record<StatusTone, string> = {
  success: 'text-success',
  warning: 'text-warning-foreground dark:text-warning',
  destructive: 'text-destructive',
  info: 'text-link',
  neutral: 'text-muted-foreground',
}

/** Kit status: 8px dot + coloured label, no background. */
export default function StatusPill({ tone, children, className }: StatusPillProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-body', TEXT[tone], className)}>
      <span className={cn('size-2 shrink-0 rounded-full', DOT[tone])} aria-hidden="true" />
      {children}
    </span>
  )
}
