import { cn } from '@commerce/ui/lib/utils'

type KitDotLabelProps = { tone: 'success' | 'destructive' | 'muted'; children: string }

const DOT = {
  success: 'bg-success',
  destructive: 'bg-destructive',
  muted: 'bg-muted-foreground-soft',
} as const

/** Sheet 14:1037 payment cell: 8px dot, 8px gap, 15/400 label. */
export default function KitDotLabel({ tone, children }: KitDotLabelProps) {
  // Render logic
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('size-2 shrink-0 rounded-full', DOT[tone])} aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}
