import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type StatusChipProps = {
  /**
   * `neutral` is every finished or quiet state. The coloured tones: success (good news: paid,
   * delivered), attention (waiting on someone), info (to do or in progress), violet (on the
   * way), danger (failed or owed).
   */
  tone?: 'neutral' | 'attention' | 'info' | 'danger' | 'success' | 'violet'
  children: ReactNode
  className?: string
}

/* Figma "Badge" status variants: a soft fill, a matching border, the strong text colour and a
   6px dot in it. */
const TONE = {
  neutral: 'border-neutral-border bg-neutral-soft text-neutral',
  attention: 'border-warning-border bg-warning-soft text-warning',
  info: 'border-info-border bg-info-soft text-info',
  danger: 'border-danger-border bg-danger-soft text-danger',
  success: 'border-success-border bg-success-soft text-success',
  violet: 'border-violet-border bg-violet-soft text-violet',
} as const

/** Status chip (Figma "Badge"): 22px, radius 6, dot + label, one tone per state. */
export default function StatusChip({ tone = 'neutral', children, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center gap-1 rounded-[0.375rem] border px-2 text-xs font-medium whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  )
}
