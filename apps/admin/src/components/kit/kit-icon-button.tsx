import { cn } from '@commerce/ui/lib/utils'
import type { ComponentProps, ReactNode } from 'react'

type KitIconButtonProps = Omit<ComponentProps<'button'>, 'className' | 'children'> & {
  label: string
  children: ReactNode
  className?: string
}

/** Sheet 14:992: 40px square, white, Neutral/300 hairline, radius 4, 20px glyph. */
export default function KitIconButton({ label, children, className, ...rest }: KitIconButtonProps) {
  // Render logic
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-sm border border-line bg-card text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
