import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type StatusChipProps = {
  /**
   * `neutral` is every finished or quiet state (grey with a hairline). The coloured tones are
   * for states that need someone to act: attention (to ship), info (in progress), danger
   * (failed), success (only when good news is itself the next step).
   */
  tone?: 'neutral' | 'attention' | 'info' | 'danger' | 'success'
  children: ReactNode
  className?: string
}

const TONE = {
  neutral: 'border-hairline bg-chip-neutral text-muted-foreground',
  attention: 'border-transparent bg-warning-soft text-warning',
  info: 'border-transparent bg-info-soft text-info',
  danger: 'border-transparent bg-danger-soft text-danger',
  success: 'border-transparent bg-success-soft text-success',
} as const

/** Status chip (Figma "Status chip"): coloured only when action is needed, else neutral grey. */
export default function StatusChip({ tone = 'neutral', children, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border px-2.5 text-caption font-medium whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
