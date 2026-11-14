import { cn } from '@commerce/ui/lib/utils'
import { DialogHeader as BaseDialogHeader } from '@commerce/ui/shadcn/dialog'
import type { ComponentProps } from 'react'

type DialogHeaderProps = ComponentProps<typeof BaseDialogHeader>

/**
 * The title block of the admin popup shell (`dialog-content.tsx`): it stays at the top while a
 * long dialog scrolls, and leaves room on the right for the close button. Left-aligned at every
 * size, 1rem/500 title, no icons (audit 3.4).
 */
export default function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return (
    <BaseDialogHeader
      {...props}
      className={cn(
        'sticky -top-4 z-10 -mx-4 -mt-4 bg-popover px-4 pt-4 pr-12 pb-1',
        // A panel dialog (`dialog-content.tsx` `panel`) does not scroll as a whole.
        'in-data-[dialog-body=panel]:static in-data-[dialog-body=panel]:m-0 in-data-[dialog-body=panel]:pb-4',
        className,
      )}
    />
  )
}
