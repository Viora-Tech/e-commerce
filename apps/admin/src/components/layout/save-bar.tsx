'use client'

import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect } from 'react'
import FloatingBar from './floating-bar'
import LeaveGuard from './leave-guard'

type SaveBarProps = {
  /** Render while the form is dirty; the bar slides in and out on change. */
  open: boolean
  message: string
  saveLabel: string
  discardLabel: string
  onSave: () => void
  onDiscard: () => void
  saving?: boolean
}

/**
 * Contextual save bar: a small floating pill at the bottom centre of the
 * screen while the form has unsaved changes. Render it anywhere in the page
 * (e.g. first child of PageBody) with `open`.
 */
export default function SaveBar({
  open,
  message,
  saveLabel,
  discardLabel,
  onSave,
  onDiscard,
  saving = false,
}: SaveBarProps) {
  // Hooks
  // While the bar floats, the page gets room under its last row (admin-frame's `main`), so
  // the bar never sits on top of what the merchant just added.
  useEffect(() => {
    const main = document.getElementById('main')
    if (!open || !main) return
    main.dataset.saveBar = ''
    return () => {
      delete main.dataset.saveBar
    }
  }, [open])

  return (
    <>
      <LeaveGuard when={open && !saving} />
      <FloatingBar open={open}>
        <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-caption font-medium whitespace-nowrap text-foreground">
          {message}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-1 rounded-full"
          onClick={onDiscard}
          disabled={saving}
        >
          {discardLabel}
        </Button>
        <Button type="button" size="sm" className="rounded-full" onClick={onSave} loading={saving}>
          {saveLabel}
        </Button>
      </FloatingBar>
    </>
  )
}
