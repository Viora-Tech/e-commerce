import { cn } from '@commerce/ui/lib/utils'

type LiveChipProps = {
  label: string
  tone?: 'success' | 'warning' | 'info' | 'danger' | 'neutral'
  className?: string
}

const TONE = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning-foreground dark:text-warning',
  info: 'bg-info-soft text-info',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-muted text-muted-foreground',
} as const

const DOT_TONE = {
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  danger: 'bg-danger',
  neutral: 'bg-muted-foreground-soft',
} as const

/** A dot in a soft tinted pill, uppercase tracked caption (store "Online", payment "Paid"). */
export default function LiveChip({ label, tone = 'success', className }: LiveChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[0.6875rem] font-medium uppercase tracking-[0.06em]',
        TONE[tone],
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', DOT_TONE[tone])} aria-hidden="true" />
      {label}
    </span>
  )
}
