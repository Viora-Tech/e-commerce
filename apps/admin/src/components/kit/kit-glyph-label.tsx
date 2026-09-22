import type { IconComponent } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

type KitGlyphLabelProps = {
  icon: IconComponent
  tone: 'success' | 'warning' | 'destructive' | 'foreground'
  children: string
}

const TONE = {
  success: 'text-success',
  warning: 'text-warning-foreground dark:text-warning',
  destructive: 'text-destructive',
  foreground: 'text-foreground',
} as const

/** Sheet 14:1041 status cell: 24px glyph, 8px gap, 15/400 label in the status colour. */
export default function KitGlyphLabel({ icon: Icon, tone, children }: KitGlyphLabelProps) {
  // Render logic
  return (
    <span className={cn('inline-flex items-center gap-2', TONE[tone])}>
      <Icon className="size-6 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}
