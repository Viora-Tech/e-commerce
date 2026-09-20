import type React from 'react'
import { cn } from '../../../lib/utils'
import { Button } from '../../shadcn/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../shadcn/sheet'

type GlobalSheetProps = {
  /** Trigger element - if wrapTrigger is true, wrapped in Button */
  trigger: React.ReactNode
  /** Sheet content */
  children: React.ReactNode
  /** Sheet title (for accessibility) */
  title?: string
  /** Sheet description (for accessibility) */
  description?: string
  /** Additional className for SheetContent */
  className?: string
  /** Side to open from */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Controlled open state */
  open?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  /** Wrap trigger in Button (default: true for backward compatibility) */
  wrapTrigger?: boolean
  /** Button variant when wrapTrigger is true */
  triggerVariant?: 'default' | 'secondary' | 'ghost' | 'outline'
}

function GlobalSheet({
  title,
  description,
  trigger,
  children,
  className,
  side = 'right',
  open,
  onOpenChange,
  wrapTrigger = true,
  triggerVariant = 'secondary',
}: GlobalSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {wrapTrigger ? <Button variant={triggerVariant}>{trigger}</Button> : trigger}
      </SheetTrigger>
      <SheetContent
        className={cn(side === 'bottom' && 'h-[85vh] rounded-t-2xl', className)}
        side={side}
      >
        <SheetHeader className={cn(!title && !description && 'sr-only')}>
          <SheetTitle className={cn(!title && 'sr-only')}>{title || 'Sheet'}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}

export { GlobalSheet }
export default GlobalSheet
