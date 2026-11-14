'use client'

import { X } from '@commerce/ui/icons'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import { type ReactNode, useState } from 'react'
import { dialogContent } from '@/data/common'
import { useCopy } from '@/hooks/use-copy'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body?: string
  confirmLabel: string
  /** Defaults to the shared "Cancel". */
  cancelLabel?: string
  /** `default` (the primary button) unless the action deletes, cancels, refunds, removes,
   *  uninstalls, discards or disconnects: then pass `destructive` for the red button. */
  tone?: 'destructive' | 'default'
  /** Busy state owned by the caller, who then also closes the dialog; without it the dialog tracks `onConfirm` itself. */
  busy?: boolean
  /** Keeps the confirm button off, e.g. while the item is still in use. */
  confirmDisabled?: boolean
  /** A returned promise keeps the dialog busy, then closes it; a throw leaves it open. */
  onConfirm: () => void | Promise<void>
  /** For dialogs rendered inside a clickable row. */
  stopPropagation?: boolean
  children?: ReactNode
}

/** The one "Are you sure?" popup: title, plain words, a cancel and a confirm button. */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  busy,
  confirmDisabled = false,
  onConfirm,
  stopPropagation = false,
  children,
}: ConfirmDialogProps) {
  // Hooks
  const shared = useCopy(dialogContent)
  const [pending, setPending] = useState(false)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (!next && (pending || busy)) return
    onOpenChange(next)
  }
  const handleConfirm = async () => {
    const result = onConfirm()
    if (!(result instanceof Promise)) {
      if (busy === undefined) onOpenChange(false)
      return
    }
    setPending(true)
    try {
      await result
      onOpenChange(false)
    } catch {
      // The caller reports the failure; the dialog stays open for another try.
    } finally {
      setPending(false)
    }
  }

  // Render logic
  const working = pending || Boolean(busy)
  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className="max-h-[min(85svh,48rem)] overflow-y-auto overscroll-contain data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-[38rem]"
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        {/* Figma confirm dialogs (e.g. 638:5415) close from the corner too. */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 text-muted-foreground"
          onClick={() => handleOpenChange(false)}
          disabled={working}
          aria-label={shared.close}
        >
          <X aria-hidden />
        </Button>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {body ? <AlertDialogDescription>{body}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>{cancelLabel ?? shared.cancel}</AlertDialogCancel>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            loading={working}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
