import { cn } from '@commerce/ui/lib/utils'
import { DialogFooter as BaseDialogFooter } from '@commerce/ui/shadcn/dialog'
import type { ComponentProps } from 'react'

type DialogFooterProps = ComponentProps<typeof BaseDialogFooter>

/**
 * The button row of the admin popup shell (`dialog-content.tsx`): it stays at the bottom while
 * a long dialog scrolls. Opaque, in the footer's muted tint, so fields never show through it.
 */
export default function DialogFooter({ className, ...props }: DialogFooterProps) {
  return (
    <BaseDialogFooter
      {...props}
      className={cn(
        'sticky -bottom-4 z-10 bg-[color-mix(in_oklab,var(--muted)_50%,var(--popover))]',
        className,
      )}
    />
  )
}
