'use client'

import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import FloatingBar from './floating-bar'

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
  return (
    <FloatingBar open={open}>
      <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-caption font-medium whitespace-nowrap text-foreground">{message}</span>
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
  )
}
