import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import { CHIP_DOT, CHIP_OUTLINE, CHIP_SOFT, type ChipTone } from '@/components/status/tone'

type StatusChipProps = {
  /**
   * `neutral` is every finished or quiet state. The coloured tones: success (good news: paid,
   * delivered), attention (waiting on someone), info (to do or in progress), violet (on the
   * way), danger (failed or owed).
   */
  tone?: ChipTone
  /** `soft`: tinted fill and border (default). `outline`: border only. `dot`: no box, a dot and ink text. */
  variant?: 'soft' | 'dot' | 'outline'
  children: ReactNode
  className?: string
}

/** Status chip (Figma "Badge"): 22px, radius 6, dot + label, one tone per state. The one chip in the admin. */
export default function StatusChip({
  tone = 'neutral',
  variant = 'soft',
  children,
  className,
}: StatusChipProps) {
  // Render logic
  const dot = (
    <span
      aria-hidden="true"
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        variant === 'dot' ? CHIP_DOT[tone] : 'bg-current',
      )}
    />
  )

  if (variant === 'dot') {
    return (
      <span
        className={cn(
          'inline-flex h-5.5 items-center gap-1.5 text-period font-medium whitespace-nowrap text-foreground',
          className,
        )}
      >
        {dot}
        {children}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center gap-1 rounded-[0.375rem] border px-2 text-period font-medium whitespace-nowrap',
        variant === 'outline' ? CHIP_OUTLINE[tone] : CHIP_SOFT[tone],
        className,
      )}
    >
      {dot}
      {children}
    </span>
  )
}
