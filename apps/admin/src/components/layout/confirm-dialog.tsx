'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { type ReactNode, useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
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
  /** Required (audit 9a): `destructive` (the red button) when the action deletes, cancels,
   *  refunds, removes, uninstalls, discards, disconnects or turns something off; `default`
   *  (the primary button) for everything else. */
  tone: 'destructive' | 'default'
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

/**
 * The one "Are you sure?" popup: title, plain words, a cancel and a confirm button. Built on the
 * admin popup shell (audit 9b), so it is left-aligned on phones, keeps its title clear of the X
 * and its buttons stay put while extra content scrolls. Never closes on a click outside, and
 * nothing closes it while it works.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone,
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
    <Dialog open={open} onOpenChange={handleOpenChange} disablePointerDismissal>
      <DialogContent
        role="alertdialog"
        busy={working}
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {body ? <DialogDescription>{body}</DialogDescription> : null}
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" disabled={working} onClick={() => handleOpenChange(false)}>
            {cancelLabel ?? shared.cancel}
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            loading={working}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
