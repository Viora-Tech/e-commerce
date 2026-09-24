import type { IconComponent } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

type IconBadgeProps = {
  icon: IconComponent
  /** Matches `StatusTone`'s meaning: success/warning/info/danger tint the tile, neutral is grey. */
  tone?: 'success' | 'warning' | 'info' | 'danger' | 'neutral'
  size?: 'sm' | 'md'
  className?: string
}

const TONE = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning-foreground dark:text-warning',
  info: 'bg-info-soft text-info',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-muted text-muted-foreground',
} as const

const SIZE = { sm: 'size-8 [&_svg]:size-4', md: 'size-10 [&_svg]:size-5' } as const

/** Icon in a soft-tinted rounded square, for page headers and empty states. */
export default function IconBadge({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
}: IconBadgeProps) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl',
        TONE[tone],
        SIZE[size],
        className,
      )}
      aria-hidden="true"
    >
      <Icon weight="duotone" />
    </span>
  )
}
