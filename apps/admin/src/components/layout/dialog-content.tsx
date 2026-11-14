'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DialogContent as BaseDialogContent,
  Dialog,
  DialogDescription,
  DialogTitle,
  useDialogGuard,
} from '@commerce/ui/shadcn/dialog'
import { type ComponentProps, useEffect, useState } from 'react'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { dialogContent } from '@/data/common'
import { useCopy } from '@/hooks/use-copy'

type DialogContentProps = ComponentProps<typeof BaseDialogContent> & {
  /**
   * `standard` for every form, confirm, picker and read-only popup (one width across the admin);
   * `wide` for editors, previews and grids; `full` for the big shipment tables and the
   * purchase-document review.
   */
  size?: 'standard' | 'wide' | 'full'
  /**
   * True while the popup saves: Esc, a click outside and the X do nothing, so a refund or a
   * cancel never closes half-way. Pass the busy state the dialog already keeps.
   */
  busy?: boolean
  /**
   * True once something was typed: Esc, a click outside or the X first ask "Discard what you
   * typed?". The footer's Cancel still closes straight away (the caller handles it).
   */
  dirty?: boolean
  /**
   * For pickers and tools with their own scrolling panes (a toolbar, a grid beside a details
   * pane): the shell keeps the width, height, scrim and X but does not scroll; the children are a
   * column (header, a `min-h-0 flex-1 overflow-y-auto` body, footer) and pad themselves.
   */
  panel?: boolean
}

/** Spacing a dialog sets for its own content (`gap-5`, `p-6`): it belongs on the scroller. */
const INNER = /^(gap|gap-[xy]|p|px|py|pt|pb|pl|pr|space-y)-/

const SIZE = {
  standard: 'max-h-[min(85svh,48rem)] sm:max-w-[38rem]',
  wide: 'max-h-[min(85svh,48rem)] sm:max-w-[56rem]',
  full: 'h-[92dvh] max-h-[92dvh] sm:max-w-[min(96vw,90rem)]',
} as const

/**
 * The one admin popup shell (owner, 31 Oct and 2 Nov 2026: every dialog the same width and
 * height). One width per size, one maximum height for all; a long dialog scrolls between its
 * title, which stays at the top (`dialog-header.tsx`), and its buttons, which stay at the bottom
 * (`dialog-footer.tsx`). The close button sits outside the scroller, so it never scrolls away.
 * `busy` and `dirty` guard the closing (audit 9c): they hook into the shadcn `Dialog` root.
 */
export default function DialogContent({
  size = 'standard',
  busy = false,
  dirty = false,
  panel = false,
  className,
  children,
  ...props
}: DialogContentProps) {
  // Hooks
  const guard = useDialogGuard()
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    if (!guard) return
    guard.guard.current = {
      block: () => {
        if (busy) return true
        if (!dirty) return false
        setAsking(true)
        return true
      },
    }
    return () => {
      guard.guard.current = null
    }
  }, [guard, busy, dirty])

  // Event handlers
  const handleDiscard = () => {
    setAsking(false)
    guard?.close()
  }

  // Render logic
  const tokens = (typeof className === 'string' ? className : '').split(/\s+/).filter(Boolean)
  const inner = tokens.filter((t) => INNER.test(t)).join(' ')
  const outer = tokens.filter((t) => !INNER.test(t)).join(' ')

  return (
    <BaseDialogContent
      {...props}
      closeDisabled={busy}
      aria-busy={busy || undefined}
      className={cn(
        // The close button sits above the sticky title bar.
        'flex flex-col gap-0 overflow-hidden p-0 [&>[data-slot=dialog-close]]:z-20',
        SIZE[size],
        outer,
      )}
    >
      <div
        data-dialog-body={panel ? 'panel' : 'scroll'}
        className={cn(
          panel
            ? 'flex min-h-0 flex-1 flex-col'
            : 'grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain p-4',
          inner,
        )}
      >
        {children}
      </div>
      {dirty ? (
        <DiscardPrompt open={asking} onOpenChange={setAsking} onDiscard={handleDiscard} />
      ) : null}
    </BaseDialogContent>
  )
}

type DiscardPromptProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDiscard: () => void
}

/** "Discard what you typed?" on top of a dirty popup; built on the shell itself. */
function DiscardPrompt({ open, onOpenChange, onDiscard }: DiscardPromptProps) {
  // Hooks
  const copy = useCopy(dialogContent)

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{copy.discardTitle}</DialogTitle>
          <DialogDescription>{copy.discardBody}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.keepEditing}
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            {copy.discard}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
