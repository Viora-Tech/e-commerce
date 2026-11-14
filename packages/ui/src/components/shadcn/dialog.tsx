'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import * as React from 'react'
import { XIcon } from '../../icons'
import { cn } from '../../lib/utils'
import { Button } from './button'

/**
 * A close guard the popup body can register (the admin shell's `busy` and `dirty`). It gets the
 * reason Base UI gives (`escape-key`, `outside-press`, `close-press`, ...) and returns true to
 * keep the dialog open. `close` finishes a close the guard held back (after "Discard?").
 */
type DialogGuard = {
  block: (reason: DialogPrimitive.Root.ChangeEventReason) => boolean
}

type DialogGuardContextValue = {
  guard: React.RefObject<DialogGuard | null>
  close: () => void
}

const DialogGuardContext = React.createContext<DialogGuardContextValue | null>(null)

/** The guard slot of the nearest `Dialog`; null outside one. */
function useDialogGuard() {
  return React.useContext(DialogGuardContext)
}

function Dialog({ onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  const guard = React.useRef<DialogGuard | null>(null)
  const held = React.useRef<DialogPrimitive.Root.ChangeEventDetails | null>(null)
  const handleOpenChange: DialogPrimitive.Root.Props['onOpenChange'] = (open, details) => {
    if (!open && details.reason !== 'imperative-action' && guard.current?.block(details.reason)) {
      held.current = details
      details.cancel()
      return
    }
    onOpenChange?.(open, details)
  }
  const close = () => {
    const details = held.current
    held.current = null
    if (details) onOpenChange?.(false, details)
  }
  return (
    <DialogGuardContext.Provider value={{ guard, close }}>
      <DialogPrimitive.Root data-slot="dialog" onOpenChange={handleOpenChange} {...props} />
    </DialogGuardContext.Provider>
  )
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn('glass-scrim fixed inset-0 isolate z-50 motion-backdrop', className)}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeDisabled = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  /** Greys the corner X out (the admin shell while it saves). */
  closeDisabled?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-dialog ring-1 ring-foreground/10 motion-dialog outline-none sm:max-w-sm',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            disabled={closeDisabled}
            render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="dialog-header" className={cn('flex flex-col gap-2', className)} {...props} />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('cn-font-heading text-base leading-none font-medium', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export type { DialogGuard }
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  useDialogGuard,
}
